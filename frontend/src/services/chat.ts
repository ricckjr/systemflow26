import { supabase } from '@/services/supabase'
import { ChatRoom, ChatMessage, ChatAttachment, ChatMessageReceipt } from '@/types/chat'
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
          created_by,
          metadata,
          last_message_at,
          my_member:chat_room_members!inner(user_id),
          members:chat_room_members(
            room_id,
            user_id,
            joined_at,
            last_read_at,
            role,
            profile:profiles!chat_room_members_user_id_fkey(${PROFILE_SELECT})
          )
        `
      )
      .eq('my_member.user_id', userId)
      .order('last_message_at', { ascending: false })

    if (error) throw error

    const rooms = (data ?? []).map((r: any) => {
      const { my_member: _myMember, ...rest } = r ?? {}
      return rest as ChatRoom
    })

    const roomIds = rooms.map((r) => r.id).filter(Boolean)
    if (roomIds.length === 0) return rooms

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
        if (fallbackError) return rooms
        const lastMessageByRoom = new Map<string, ChatMessage>()
        for (const row of fallbackData ?? []) {
          const roomId = row?.room_id
          if (!roomId || lastMessageByRoom.has(roomId)) continue
          lastMessageByRoom.set(roomId, normalizeMessage(row))
        }
        return rooms.map((room) => ({
          ...room,
          last_message: lastMessageByRoom.get(room.id),
        }))
      }
      return rooms
    }

    const lastMessageByRoom = new Map<string, ChatMessage>()
    for (const row of messagesData ?? []) {
      const roomId = row?.room_id
      if (!roomId || lastMessageByRoom.has(roomId)) continue
      lastMessageByRoom.set(roomId, normalizeMessage(row))
    }

    return rooms.map((room) => ({
      ...room,
      last_message: lastMessageByRoom.get(room.id),
    }))
  },

  async getMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      if (error.code === '42P01') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('chat_messages')
          .select(MESSAGE_SELECT_BASE)
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })
          .limit(limit)
        if (fallbackError) throw fallbackError
        return (fallbackData ?? []).map(normalizeMessage)
      }
      throw error
    }

    return (data ?? []).map(normalizeMessage)
  },

  async getMessagesBefore(roomId: string, beforeCreatedAt: string, limit = 50): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT_WITH_RECEIPTS)
      .eq('room_id', roomId)
      .lt('created_at', beforeCreatedAt)
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

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content: contentToInsert,
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

  async uploadAttachment(file: File): Promise<{ publicUrl: string; path: string }> {
    const userId = await getCurrentUserId()

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo não permitido')
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Arquivo excede 5MB')
    }

    const fileName = sanitizeFileName(file.name)
    const path = `${userId}/${crypto.randomUUID()}-${fileName}`

    const { error } = await supabase
      .storage
      .from('chat-attachments')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (error) {
      throw error
    }

    const publicUrl = supabase
      .storage
      .from('chat-attachments')
      .getPublicUrl(path)
      .data
      .publicUrl

    return { publicUrl, path }
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
