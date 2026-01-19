import { supabase } from '@/services/supabase'
import { ChatRoom, ChatMessage, ChatAttachment } from '@/types/chat'

/* ======================================================
   HELPERS
====================================================== */
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

/* ======================================================
   CHAT SERVICE
====================================================== */
export const chatService = {
  /* ==================================================
     ROOMS (MEMBERSHIP DO USUÁRIO)
  =================================================== */
  async getRooms(userId: string): Promise<ChatRoom[]> {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        id,
        type,
        name,
        last_message_at,
        chat_room_members (
          user_id,
          last_read_at,
          role
        )
      `)
      .eq('chat_room_members.user_id', userId)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('[chat] getRooms', error)
      return []
    }

    return (data ?? []).map((room: any) => ({
      ...room,
      membership: room.chat_room_members?.[0] ?? null,
    })) as ChatRoom[]
  },

  /* ==================================================
     MESSAGES (ÚLTIMAS MENSAGENS)
  =================================================== */
  async getMessages(
    roomId: string,
    limit = 50
  ): Promise<ChatMessage[]> {

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        room_id,
        sender_id,
        content,
        attachments,
        created_at,
        is_edited
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[chat] getMessages', error)
      return []
    }

    return (data ?? [])
      .reverse()
      .map((m: any) => ({
        ...m,
        attachments: normalizeAttachments(m.attachments),
      })) as ChatMessage[]
  },

  /* ==================================================
     SEND MESSAGE
  =================================================== */
  async sendMessage(
    roomId: string,
    userId: string,
    content: string,
    attachments: ChatAttachment[] = []
  ): Promise<ChatMessage | null> {

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content,
        attachments,
      })
      .select(`
        id,
        room_id,
        sender_id,
        content,
        attachments,
        created_at,
        is_edited
      `)
      .single()

    if (error || !data) {
      console.error('[chat] sendMessage', error)
      return null
    }

    return {
      ...(data as ChatMessage),
      attachments: normalizeAttachments(data.attachments),
    }
  },

  /* ==================================================
     UPLOAD DE ANEXO (SEGURO)
  =================================================== */
  async uploadAttachment(
    userId: string,
    file: File
  ): Promise<string | null> {

    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
      throw new Error('Tipo de arquivo não permitido')
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Arquivo excede 5MB')
    }

    const ext = file.type === 'image/png'
      ? 'png'
      : file.type === 'image/jpeg'
      ? 'jpg'
      : 'pdf'

    const path = `${userId}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase
      .storage
      .from('chat-attachments')
      .upload(path, file, { upsert: false })

    if (error) {
      console.error('[chat] uploadAttachment', error)
      return null
    }

    return supabase
      .storage
      .from('chat-attachments')
      .getPublicUrl(path)
      .data
      .publicUrl
  },

  /* ==================================================
     MARK AS READ
  =================================================== */
  async markAsRead(roomId: string, userId: string) {
    await supabase
      .from('chat_room_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
  },

  /* ==================================================
     REALTIME (COM CLEANUP)
  =================================================== */
  subscribeToNewMessages(
    roomId: string,
    callback: (msg: ChatMessage) => void
  ) {
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
        (payload) => {
          const msg = payload.new as any
          callback({
            ...msg,
            attachments: normalizeAttachments(msg.attachments),
          } as ChatMessage)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}
