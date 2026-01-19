import { supabase } from '@/services/supabase'
import { ChatRoom, ChatMessage, ChatAttachment } from '@/types/chat'

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
        name: o.name,
        size: typeof o.size === 'number' ? o.size : undefined,
        mime_type: typeof o.mime_type === 'string' ? o.mime_type : undefined,
      } as ChatAttachment
    })
    .filter(Boolean)
}

const PROFILE_SELECT =
  'id,nome,avatar_url,email_login,ativo,created_at,cargo' as const

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('Usuário não autenticado')
  return userId
}

function normalizeMessage(input: any): ChatMessage {
  return {
    ...(input as ChatMessage),
    content: typeof input?.content === 'string' ? input.content : '',
    attachments: normalizeAttachments(input?.attachments),
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
            profile:profiles(${PROFILE_SELECT})
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
      .select(
        `
          id,
          room_id,
          sender_id,
          content,
          attachments,
          created_at,
          updated_at,
          is_edited,
          reply_to_id,
          sender:profiles(${PROFILE_SELECT})
        `
      )
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(Math.min(roomIds.length * 10, 200))

    if (messagesError) return rooms

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
      .select(
        `
          id,
          room_id,
          sender_id,
          content,
          attachments,
          created_at,
          updated_at,
          is_edited,
          reply_to_id,
          sender:profiles(${PROFILE_SELECT})
        `
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    return (data ?? []).map(normalizeMessage)
  },

  async sendMessage(
    roomId: string,
    content: string,
    attachments: ChatAttachment[] = []
  ): Promise<ChatMessage> {
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content: content?.trim() ? content : null,
        attachments: attachments.length > 0 ? attachments : null,
      })
      .select(
        `
          id,
          room_id,
          sender_id,
          content,
          attachments,
          created_at,
          updated_at,
          is_edited,
          reply_to_id,
          sender:profiles(${PROFILE_SELECT})
        `
      )
      .single()

    if (error) throw error
    if (!data) throw new Error('Falha ao enviar mensagem')

    return normalizeMessage(data)
  },

  async uploadAttachment(file: File): Promise<string> {
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

    return supabase
      .storage
      .from('chat-attachments')
      .getPublicUrl(path)
      .data
      .publicUrl
  },

  async markAsRead(roomId: string) {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('chat_room_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
    if (error) throw error
  },

  async createDirectChat(otherUserId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
      other_user_id: otherUserId,
    })
    if (error) throw error
    if (!data) throw new Error('Falha ao criar/abrir chat direto')
    return data
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
  }
}
