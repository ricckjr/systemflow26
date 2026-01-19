import { supabase } from '@/services/supabase'
import { ChatRoom, ChatMessage, ChatAttachment } from '@/types/chat'

/* ======================================================
   HELPERS
====================================================== */
function normalizeAttachments(input: unknown): ChatAttachment[] | undefined {
  if (!Array.isArray(input)) return undefined

  const out = input
    .map((a) => {
      if (!a || typeof a !== 'object') return null
      const o = a as any

      if (
        typeof o.type !== 'string' ||
        typeof o.url !== 'string' ||
        typeof o.name !== 'string'
      ) return null

      return {
        type: o.type,
        url: o.url,
        name: o.name,
        size: typeof o.size === 'number' ? o.size : undefined,
        mime_type: typeof o.mime_type === 'string' ? o.mime_type : undefined
      } as ChatAttachment
    })
    .filter(Boolean) as ChatAttachment[]

  return out.length ? out : undefined
}

async function getCurrentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}

/* ======================================================
   CHAT SERVICE
====================================================== */
export const chatService = {
  /* ==================================================
     ROOMS (LEVE – SEM JOIN PESADO)
  =================================================== */
  async getRooms(): Promise<ChatRoom[]> {
    const userId = await getCurrentUserId()

    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        id,
        type,
        name,
        last_message_at,
        chat_room_members!inner (
          user_id,
          last_read_at,
          role
        )
      `)
      .eq('chat_room_members.user_id', userId)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar salas:', error)
      return []
    }

    return data as ChatRoom[]
  },

  /* ==================================================
     MESSAGES (SEM JOIN DE NOTIFICATION)
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
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Erro ao buscar mensagens:', error)
      return []
    }

    return data.map((m: any) => ({
      ...m,
      attachments: normalizeAttachments(m.attachments)
    })) as ChatMessage[]
  },

  /* ==================================================
     SEND MESSAGE
  =================================================== */
  async sendMessage(
    roomId: string,
    content: string,
    attachments: ChatAttachment[] = []
  ): Promise<ChatMessage | null> {

    const userId = await getCurrentUserId()

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content,
        attachments
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
      console.error('Erro ao enviar mensagem:', error)
      return null
    }

    return {
      ...(data as ChatMessage),
      attachments: normalizeAttachments(data.attachments)
    }
  },

  /* ==================================================
     UPLOAD DE ANEXO (SIMPLES)
  =================================================== */
  async uploadAttachment(file: File): Promise<string | null> {
    const userId = await getCurrentUserId()

    const ext = file.name.split('.').pop()
    const path = `${userId}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase
      .storage
      .from('chat-attachments')
      .upload(path, file)

    if (error) {
      console.error('Erro upload chat:', error)
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
     DIRECT CHAT (RPC)
  =================================================== */
  async createDirectChat(otherUserId: string): Promise<string> {
    const { data, error } = await supabase
      .rpc('get_or_create_direct_chat', {
        other_user_id: otherUserId
      })

    if (error) throw error
    return data as string
  },

  /* ==================================================
     MARK AS READ
  =================================================== */
  async markAsRead(roomId: string) {
    const userId = await getCurrentUserId()

    await supabase
      .from('chat_room_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
  },

  /* ==================================================
     REALTIME (SEM QUERY EXTRA)
  =================================================== */
  subscribeToNewMessages(
    roomId: string,
    callback: (msg: ChatMessage) => void
  ) {
    return supabase
      .channel(`chat_room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const msg = payload.new as any

          callback({
            ...msg,
            attachments: normalizeAttachments(msg.attachments)
          } as ChatMessage)
        }
      )
      .subscribe()
  }
}
