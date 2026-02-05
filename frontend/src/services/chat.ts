import { supabase } from '@/services/supabase'
import { ChatRoom, ChatMessage, ChatAttachment, ChatMessageReceipt, type ChatMessageType } from '@/types/chat'
import type { Json } from '@/types/database.types'

function normalizeAttachments(input: unknown): ChatAttachment[] {
  if (!Array.isArray(input)) return []

  return input
    .map((o: any) => {
      if (
        typeof o?.type !== 'string' ||
        typeof o?.url !== 'string' ||
        typeof o?.name !== 'string'
      ) return null

      return {
        type: o.type,
        url: o.url,
        path: typeof o.path === 'string' ? o.path : undefined,
        name: o.name,
        size: typeof o.size === 'number' ? o.size : undefined,
        mime_type: typeof o.mime_type === 'string' ? o.mime_type : undefined,
      } as ChatAttachment
    })
    .filter((a): a is ChatAttachment => a !== null)
}

const PROFILE_SELECT =
  'id,nome,avatar_url,email_login,ativo,created_at,cargo' as const

const MESSAGE_SELECT_BASE = `
  id,
  room_id,
  sender_id,
  content,
  message_type,
  attachments,
  created_at,
  updated_at,
  edited_at,
  deleted_at,
  is_edited,
  reply_to_id,
  sender:profiles!chat_messages_sender_id_fkey(${PROFILE_SELECT})
` as const

const MESSAGE_SELECT_WITH_RECEIPTS = `
  ${MESSAGE_SELECT_BASE},
  receipts:chat_message_receipts(user_id,delivered_at,read_at)
` as const

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('Usuário não autenticado')
  return userId
}

function normalizeMessage(input: any): ChatMessage {
  const receipts = Array.isArray(input?.receipts)
    ? (input.receipts as any[]).map((r) => ({
        user_id: r?.user_id,
        delivered_at: r?.delivered_at ?? null,
        read_at: r?.read_at ?? null,
      })) as ChatMessageReceipt[]
    : undefined

  return {
    ...(input as ChatMessage),
    content: typeof input?.content === 'string' ? input.content : '',
    attachments: normalizeAttachments(input?.attachments),
    receipts,
    edited_at: typeof input?.edited_at === 'string' ? input.edited_at : input?.edited_at ?? null,
    deleted_at: typeof input?.deleted_at === 'string' ? input.deleted_at : input?.deleted_at ?? null,
  }
}

function sanitizeFileName(input: string) {
  const name = input.trim().replace(/[/\\?%*:|"<>]/g, '-')
  return name.length > 0 ? name : 'arquivo'
}

function encodeStoragePath(path: string) {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

const signedUrlCache = new Map<string, { url: string; expAt: number }>()

function getSupabaseBaseUrl() {
  const raw = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const useDevProxy =
    import.meta.env.DEV &&
    String(import.meta.env.VITE_SUPABASE_DEV_PROXY || '1') === '1' &&
    typeof window !== 'undefined' &&
    !!window.location?.origin
  return useDevProxy ? window.location.origin : raw
}

function inferMessageType(content: string, attachments: ChatAttachment[]): ChatMessageType {
  const trimmed = (content ?? '').trim()
  if (trimmed) return 'text'
  if (!attachments || attachments.length === 0) return 'text'
  if (attachments.length === 1) {
    const t = attachments[0]?.type
    if (t === 'image') return 'image'
    if (t === 'audio') return 'audio'
    return 'file'
  }
  return 'file'
}

export const chatService = {
  async getRooms(): Promise<ChatRoom[]> {
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
      .from('chat_rooms')
      .select(
        `
          id,
          created_at,
          updated_at,
          type,
          name,
          description,
          avatar_path,
          created_by,
          metadata,
          last_message_at,
          my_member:chat_room_members!inner(user_id,hidden_at,cleared_at),
          members:chat_room_members(
            room_id,
            user_id,
            joined_at,
            last_read_at,
            hidden_at,
            cleared_at,
            role,
            profile:profiles!chat_room_members_user_id_fkey(${PROFILE_SELECT})
          )
        `
      )
      .eq('my_member.user_id', userId)
      .order('last_message_at', { ascending: false })

    if (error) throw error

    const roomsRaw = (data ?? []).map((r: any) => r ?? {})
    const roomsWithState = roomsRaw.map((r: any) => {
      const myMember = Array.isArray(r?.my_member) ? r.my_member[0] : r?.my_member
      const { my_member: _myMember, ...rest } = r ?? {}
      return { room: rest as ChatRoom, myMember }
    })

    const visibleRooms = roomsWithState
      .filter(({ room, myMember }: any) => {
        const hiddenAt = myMember?.hidden_at ? new Date(myMember.hidden_at).getTime() : null
        if (!hiddenAt) return true
        const lastAt = room?.last_message_at ? new Date(room.last_message_at).getTime() : 0
        return lastAt > hiddenAt
      })
      .map(({ room }: any) => room)

    await Promise.all(
      visibleRooms.map(async (room: any) => {
        if (room?.type !== 'group') return
        const path = String(room?.avatar_path || '').trim()
        if (!path) return
        try {
          room.avatar_url = await chatService.getSignedRoomAvatarUrl(path, 60 * 60)
        } catch {
          room.avatar_url = null
        }
      })
    )

    const roomIds = visibleRooms.map((r) => r.id).filter(Boolean)
    if (roomIds.length === 0) return visibleRooms

    const { data: messagesData, error: messagesError } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(Math.min(roomIds.length * 10, 200))

    if (messagesError) {
      if (messagesError.code === '42P01') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('chat_messages')
          .select(MESSAGE_SELECT_BASE)
          .in('room_id', roomIds)
          .order('created_at', { ascending: false })
          .limit(Math.min(roomIds.length * 10, 200))
        if (fallbackError) return visibleRooms
        const lastMessageByRoom = new Map<string, ChatMessage>()
        for (const row of fallbackData ?? []) {
          const roomId = row?.room_id
          if (!roomId || lastMessageByRoom.has(roomId)) continue
          lastMessageByRoom.set(roomId, normalizeMessage(row))
        }
        return visibleRooms.map((room) => ({
          ...room,
          last_message: lastMessageByRoom.get(room.id),
        }))
      }
      return visibleRooms
    }

    const lastMessageByRoom = new Map<string, ChatMessage>()
    for (const row of messagesData ?? []) {
      const roomId = row?.room_id
      if (!roomId || lastMessageByRoom.has(roomId)) continue
      lastMessageByRoom.set(roomId, normalizeMessage(row))
    }

    return visibleRooms.map((room) => ({
      ...room,
      last_message: lastMessageByRoom.get(room.id),
    }))
  },

  async getMessages(roomId: string, limit = 50, afterCreatedAtExclusive?: string | null): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .eq('room_id', roomId)
      .gt('created_at', afterCreatedAtExclusive ?? '1970-01-01T00:00:00.000Z')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      if (error.code === '42P01') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('chat_messages')
          .select(MESSAGE_SELECT_BASE)
          .eq('room_id', roomId)
          .gt('created_at', afterCreatedAtExclusive ?? '1970-01-01T00:00:00.000Z')
          .order('created_at', { ascending: true })
          .limit(limit)
        if (fallbackError) throw fallbackError
        return (fallbackData ?? []).map(normalizeMessage)
      }
      throw error
    }

    return (data ?? []).map(normalizeMessage)
  },

  async getMessagesBefore(
    roomId: string,
    beforeCreatedAt: string,
    limit = 50,
    afterCreatedAtExclusive?: string | null
  ): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .eq('room_id', roomId)
      .lt('created_at', beforeCreatedAt)
      .gt('created_at', afterCreatedAtExclusive ?? '1970-01-01T00:00:00.000Z')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    const rows = (data ?? []).map(normalizeMessage)
    return rows.reverse()
  },

  async sendMessage(
    roomId: string,
    content: string,
    attachments: ChatAttachment[] = [],
    replyToId?: string | null
  ): Promise<ChatMessage> {
    const userId = await getCurrentUserId()
    const trimmedContent = (content ?? '').trim()
    if (!trimmedContent && attachments.length === 0) {
      throw new Error('Mensagem vazia')
    }
    const contentToInsert = trimmedContent
    const messageType = inferMessageType(contentToInsert, attachments)

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content: contentToInsert,
        message_type: messageType,
        attachments: attachments.length > 0 ? (attachments as unknown as Json[]) : null,
        reply_to_id: replyToId ?? null,
      })
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .single()

    if (error) {
      if (error.code === '42P01') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('chat_messages')
          .insert({
            room_id: roomId,
            sender_id: userId,
            content: contentToInsert,
            message_type: messageType,
            attachments: attachments.length > 0 ? (attachments as unknown as Json[]) : null,
            reply_to_id: replyToId ?? null,
          })
          .select(MESSAGE_SELECT_BASE)
          .single()
        if (fallbackError) throw fallbackError
        if (!fallbackData) throw new Error('Falha ao enviar mensagem')
        return normalizeMessage(fallbackData)
      }
      throw error
    }
    if (!data) throw new Error('Falha ao enviar mensagem')

    return normalizeMessage(data)
  },

  async uploadAttachment(
    roomId: string,
    file: File,
    opts?: { onProgress?: (pct: number) => void }
  ): Promise<{ path: string; signedUrl: string }> {
    const userId = await getCurrentUserId()

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/webm',
      'audio/ogg',
      'audio/mpeg',
      'audio/wav',
    ]

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo não permitido')
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('Arquivo excede 50MB')
    }

    const fileName = sanitizeFileName(file.name)
    const path = `${roomId}/${userId}/${crypto.randomUUID()}-${fileName}`

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Sessão inválida')

    const baseUrl = getSupabaseBaseUrl()
    if (!baseUrl) throw new Error('Supabase URL inválida')

    const uploadUrl = `${baseUrl}/storage/v1/object/chat-attachments/${encodeStoragePath(path)}`
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return
        const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)))
        try {
          opts?.onProgress?.(pct)
        } catch {
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error('Falha ao enviar arquivo'))
      }
      xhr.onerror = () => reject(new Error('Falha ao enviar arquivo'))
      xhr.send(file)
    })

    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(path, 60 * 60)
    if (error) throw error
    const signedUrl = data?.signedUrl
    if (!signedUrl) throw new Error('Falha ao gerar link do arquivo')

    return { path, signedUrl }
  },

  async getSignedAttachmentUrl(path: string, expiresInSeconds = 60 * 10) {
    const clean = (path ?? '').trim()
    if (!clean) throw new Error('Path inválido')
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(clean, expiresInSeconds)
    if (error) throw error
    if (!data?.signedUrl) throw new Error('Falha ao gerar link do arquivo')
    return data.signedUrl
  },

  async uploadRoomAvatar(
    roomId: string,
    file: File,
    opts?: { onProgress?: (pct: number) => void }
  ): Promise<{ path: string; signedUrl: string }> {
    const userId = await getCurrentUserId()
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) throw new Error('Formato permitido: PNG, JPG ou WEBP')
    if (file.size > 5 * 1024 * 1024) throw new Error('A foto do grupo deve ter até 5MB')

    const fileName = sanitizeFileName(file.name)
    const path = `${roomId}/${userId}/${Date.now()}-${fileName}`

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Sessão inválida')

    const baseUrl = getSupabaseBaseUrl()
    if (!baseUrl) throw new Error('Supabase URL inválida')

    const uploadUrl = `${baseUrl}/storage/v1/object/chat-room-avatars/${encodeStoragePath(path)}`
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return
        const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)))
        try {
          opts?.onProgress?.(pct)
        } catch {
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error('Falha ao enviar imagem'))
      }
      xhr.onerror = () => reject(new Error('Falha ao enviar imagem'))
      xhr.send(file)
    })

    const { data, error } = await supabase.storage
      .from('chat-room-avatars')
      .createSignedUrl(path, 60 * 60)
    if (error) throw error
    const signedUrl = data?.signedUrl
    if (!signedUrl) throw new Error('Falha ao gerar link da imagem')

    signedUrlCache.set(path, { url: signedUrl, expAt: Date.now() + 55 * 60 * 1000 })
    return { path, signedUrl }
  },

  async getSignedRoomAvatarUrl(path: string, expiresInSeconds = 60 * 10) {
    const clean = (path ?? '').trim()
    if (!clean) throw new Error('Path inválido')
    const cached = signedUrlCache.get(clean)
    if (cached && cached.expAt > Date.now()) return cached.url
    const { data, error } = await supabase.storage
      .from('chat-room-avatars')
      .createSignedUrl(clean, expiresInSeconds)
    if (error) throw error
    if (!data?.signedUrl) throw new Error('Falha ao gerar link do avatar')
    signedUrlCache.set(clean, { url: data.signedUrl, expAt: Date.now() + Math.max(30_000, (expiresInSeconds - 30) * 1000) })
    return data.signedUrl
  },

  async updateGroupRoom(
    roomId: string,
    input: { name?: string | null; description?: string | null; avatar_path?: string | null }
  ) {
    const { error } = await supabase.rpc('update_group_chat_room', {
      room_id: roomId,
      room_name: input.name ?? null,
      room_description: input.description ?? null,
      room_avatar_path: input.avatar_path ?? null,
    })
    if (error) {
      if (error.code !== '42883') throw error
      throw new Error('RPC update_group_chat_room não encontrada no banco')
    }
  },

  async hideRoom(roomId: string) {
    const { error } = await supabase.rpc('chat_hide_room', { room_id: roomId })
    if (error) throw error
  },

  async clearRoomHistory(roomId: string) {
    const { error } = await supabase.rpc('chat_clear_room_history', { room_id: roomId })
    if (error) throw error
  },

  async leaveRoom(roomId: string) {
    const { error } = await supabase.rpc('leave_chat_room', { room_id: roomId })
    if (error) throw error
  },

  async updateMessage(messageId: string, content: string): Promise<ChatMessage> {
    const trimmed = (content ?? '').trim()
    if (!trimmed) throw new Error('Mensagem vazia')

    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        content: trimmed,
        is_edited: true,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .single()

    if (error) {
      if (error.code === '42P01') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('chat_messages')
          .update({
            content: trimmed,
            is_edited: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', messageId)
          .select(MESSAGE_SELECT_BASE)
          .single()
        if (fallbackError) throw fallbackError
        if (!fallbackData) throw new Error('Falha ao editar mensagem')
        return normalizeMessage(fallbackData)
      }
      throw error
    }

    if (!data) throw new Error('Falha ao editar mensagem')
    return normalizeMessage(data)
  },

  async softDeleteMessage(messageId: string): Promise<ChatMessage> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        deleted_at: now,
        content: 'Mensagem excluída',
        attachments: [] as unknown as Json[],
        updated_at: now,
      })
      .eq('id', messageId)
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .single()

    if (error) {
      if (error.code === '42P01') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('chat_messages')
          .update({
            content: 'Mensagem excluída',
            attachments: [] as unknown as Json[],
            updated_at: now,
          })
          .eq('id', messageId)
          .select(MESSAGE_SELECT_BASE)
          .single()
        if (fallbackError) throw fallbackError
        if (!fallbackData) throw new Error('Falha ao excluir mensagem')
        return normalizeMessage(fallbackData)
      }
      throw error
    }

    if (!data) throw new Error('Falha ao excluir mensagem')
    return normalizeMessage(data)
  },

  async removeAttachmentPaths(paths: string[]) {
    const clean = (paths ?? []).map((p) => p.trim()).filter(Boolean)
    if (clean.length === 0) return
    const { error } = await supabase.storage.from('chat-attachments').remove(clean)
    if (error) throw error
  },

  async getMessageById(messageId: string): Promise<ChatMessage | null> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .eq('id', messageId)
      .maybeSingle()
    if (error) throw error
    return data ? normalizeMessage(data) : null
  },

  async markAsRead(roomId: string) {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('chat_room_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
    if (error) throw error

    const { error: readError } = await supabase.rpc('mark_room_read', {
      room_id: roomId,
    })
    if (readError && readError.code !== '42883') throw readError
  },

  async markAllDelivered() {
    const { error } = await supabase.rpc('mark_all_delivered')
    if (error && error.code !== '42883') throw error
  },

  async markMessageDelivered(messageId: string) {
    const { error } = await supabase.rpc('mark_message_delivered', {
      message_id: messageId,
    })
    if (error && error.code !== '42883') throw error
  },

  async createDirectChat(otherUserId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
      other_user_id: otherUserId,
    })
    if (error) throw error
    if (!data) throw new Error('Falha ao criar/abrir chat direto')
    return data
  },

  async createGroupRoom(input: { name: string; description?: string | null; memberIds: string[] }) {
    const userId = await getCurrentUserId()
    const name = (input.name ?? '').trim()
    if (!name) throw new Error('Nome do grupo é obrigatório')

    const uniqueMembers = Array.from(new Set((input.memberIds ?? []).filter(Boolean)))
      .filter((id) => id !== userId)

    const { data: rpcRoomId, error: rpcError } = await supabase.rpc('create_group_chat_room', {
      room_name: name,
      room_description: (input.description ?? '').trim() || null,
      member_ids: uniqueMembers,
    })

    if (rpcError) {
      if (rpcError.code !== '42883') throw rpcError
    } else if (rpcRoomId) {
      return rpcRoomId as string
    }

    const { data: room, error } = await supabase
      .from('chat_rooms')
      .insert({
        type: 'group',
        name,
        description: (input.description ?? '').trim() || null,
        created_by: userId,
        metadata: {},
      })
      .select('id')
      .single()

    if (error) throw error
    if (!room?.id) throw new Error('Falha ao criar grupo')

    if (uniqueMembers.length > 0) {
      const { error: membersError } = await supabase
        .from('chat_room_members')
        .insert(uniqueMembers.map((id) => ({ room_id: room.id, user_id: id, role: 'member' })))
      if (membersError) throw membersError
    }
    return room.id as string
  },

  async addRoomMembers(roomId: string, userIds: string[]) {
    const unique = Array.from(new Set((userIds ?? []).filter(Boolean)))
    if (unique.length === 0) return
    const { error } = await supabase
      .from('chat_room_members')
      .insert(unique.map((id) => ({ room_id: roomId, user_id: id, role: 'member' })))
    if (error) throw error
  },

  async removeRoomMember(roomId: string, userId: string) {
    const { error } = await supabase
      .from('chat_room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)
    if (error) throw error
  },

  async getPinnedMessages(roomId: string): Promise<Array<{ message_id: string; pinned_by: string | null; pinned_at: string }>> {
    const { data, error } = await supabase
      .from('chat_message_pins')
      .select('message_id,pinned_by,pinned_at')
      .eq('room_id', roomId)
      .order('pinned_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as any
  },

  async pinMessage(roomId: string, messageId: string) {
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('chat_message_pins')
      .insert({ room_id: roomId, message_id: messageId, pinned_by: userId })
      .select('message_id,pinned_by,pinned_at')
      .single()
    if (error) throw error
    return data as any
  },

  async unpinMessage(roomId: string, messageId: string) {
    const { error } = await supabase
      .from('chat_message_pins')
      .delete()
      .eq('room_id', roomId)
      .eq('message_id', messageId)
    if (error) throw error
  },

  subscribeToPins(
    roomId: string,
    callback: (evt: { event: 'INSERT' | 'DELETE'; message_id: string; pinned_by?: string | null; pinned_at?: string }) => void
  ) {
    const channel = supabase
      .channel(`chat_pins_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_message_pins', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as any
          if (!row?.message_id) return
          callback({ event: 'INSERT', message_id: row.message_id, pinned_by: row.pinned_by ?? null, pinned_at: row.pinned_at })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_message_pins', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.old as any
          if (!row?.message_id) return
          callback({ event: 'DELETE', message_id: row.message_id })
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  async getReactions(roomId: string, messageIds: string[]) {
    const ids = (messageIds ?? []).filter(Boolean)
    if (ids.length === 0) return [] as Array<{ message_id: string; user_id: string; emoji: string }>
    const { data, error } = await supabase
      .from('chat_message_reactions')
      .select('message_id,user_id,emoji')
      .eq('room_id', roomId)
      .in('message_id', ids)
    if (error) throw error
    return (data ?? []) as any
  },

  async addReaction(roomId: string, messageId: string, emoji: string) {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('chat_message_reactions')
      .insert({ room_id: roomId, message_id: messageId, user_id: userId, emoji })
    if (error) throw error
  },

  async removeReaction(roomId: string, messageId: string, emoji: string) {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('chat_message_reactions')
      .delete()
      .eq('room_id', roomId)
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
    if (error) throw error
  },

  subscribeToReactions(
    roomId: string,
    callback: (evt: { event: 'INSERT' | 'DELETE'; message_id: string; user_id?: string; emoji?: string }) => void
  ) {
    const channel = supabase
      .channel(`chat_reactions_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_message_reactions', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as any
          if (!row?.message_id || !row?.emoji || !row?.user_id) return
          callback({ event: 'INSERT', message_id: row.message_id, user_id: row.user_id, emoji: row.emoji })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_message_reactions', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.old as any
          if (!row?.message_id || !row?.emoji || !row?.user_id) return
          callback({ event: 'DELETE', message_id: row.message_id, user_id: row.user_id, emoji: row.emoji })
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  subscribeToNewMessages(roomId: string, callback: (msg: ChatMessage) => void) {
    const channel = supabase
      .channel(`chat_room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const msg = payload.new as any
          const base = normalizeMessage(msg)

          try {
            const userId = await getCurrentUserId()
            if (base.sender_id !== userId) {
              await chatService.markMessageDelivered(base.id)
            }
          } catch {}

          const { data: senderProfile } = await supabase
            .from('profiles')
            .select(PROFILE_SELECT)
            .eq('id', base.sender_id)
            .maybeSingle()

          callback({
            ...base,
            sender: (senderProfile as any) ?? undefined,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  subscribeToMessageUpdates(roomId: string, callback: (msg: ChatMessage) => void) {
    const channel = supabase
      .channel(`chat_room_updates_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const msg = payload.new as any
          callback(normalizeMessage(msg))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  subscribeToReceiptUpdates(
    roomId: string,
    callback: (receipt: {
      message_id: string
      user_id: string
      delivered_at: string | null
      read_at: string | null
    }) => void
  ) {
    const channel = supabase
      .channel(`chat_receipts_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_message_receipts',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as any
          callback({
            message_id: row.message_id,
            user_id: row.user_id,
            delivered_at: row.delivered_at ?? null,
            read_at: row.read_at ?? null,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}
