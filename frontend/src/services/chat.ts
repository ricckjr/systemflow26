import { supabase } from './supabase';
import { ChatRoom, ChatMessage, ChatAttachment } from '@/types/chat';

const normalizeAttachments = (attachments: unknown): ChatAttachment[] | undefined => {
  if (!Array.isArray(attachments)) return undefined;

  const normalized = attachments
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;

      const type = obj.type;
      const url = obj.url;
      const name = obj.name;
      if (typeof type !== 'string' || typeof url !== 'string' || typeof name !== 'string') return null;

      const size = typeof obj.size === 'number' ? obj.size : undefined;
      const mime_type = typeof obj.mime_type === 'string' ? obj.mime_type : undefined;

      return { type, url, name, size, mime_type } as ChatAttachment;
    })
    .filter((v): v is ChatAttachment => Boolean(v));

  return normalized.length ? normalized : [];
};

export const chatService = {
  /**
   * Fetch all chat rooms for the current user, ordered by last activity.
   * Includes members to help identify direct chat partners.
   */
  async getRooms(): Promise<ChatRoom[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        chat_room_members!inner (
          user_id,
          last_read_at,
          role
        ),
        members:chat_room_members (
           user_id,
           joined_at,
           role,
           profile:profiles (
             id, nome, avatar_url, email_login
           )
        ),
        last_message:chat_messages (
          id, content, created_at, sender_id, is_edited
        )
      `)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    // Process the data to include the "last_message" properly (since the join returns an array)
    // and ensuring types match.
    return data.map((room: any) => ({
      ...room,
      last_message: room.last_message?.[0] || null, // Supabase often returns array for 1:N even with limit
      // We manually attach the 'members' with their profiles
      members: room.members.map((m: any) => ({
        ...m,
        profile: m.profile
      }))
    })) as ChatRoom[];
  },

  /**
   * Fetch messages for a specific room.
   */
  async getMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:profiles (
          id, nome, avatar_url
        ),
        notifications:chat_notifications!message_id (
           user_id, is_read
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true }) // We might want descending for pagination, but for simple chat list ascending is easier initially
      .limit(limit);

    if (error) throw error;
    
    // Process to ensure sender is correctly typed
    return data.map((msg: any) => ({
      ...msg,
      sender: msg.sender,
      // Calculate 'read_by' based on notifications for DMs or Members list
      // For now we can expose the raw notifications array to the UI if needed
      read_status: msg.notifications // Array of { user_id, is_read }
    })) as ChatMessage[];
  },

  /**
   * Send a text message to a room.
   */
  async sendMessage(roomId: string, content: string, attachments: any[] = []): Promise<ChatMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: user.id,
        content,
        attachments
      })
      .select(`
        *,
        sender:profiles (
          id, nome, avatar_url
        )
      `)
      .single();

    if (error) throw error;
    return {
      ...(data as unknown as ChatMessage),
      attachments: normalizeAttachments((data as any).attachments),
      sender: (data as any).sender
    };
  },

  /**
   * Upload a file to chat attachments bucket.
   */
  async uploadAttachment(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    // Create a path like: userId/timestamp_filename to avoid collisions and organize slightly
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  /**
   * Create or retrieve an existing 1:1 chat with another user.
   * Uses a server-side RPC function to ensure atomicity and handle RLS.
   */
  async createDirectChat(otherUserId: string): Promise<string> {
    const { data, error } = await supabase
      .rpc('get_or_create_direct_chat', { other_user_id: otherUserId });

    if (error) throw error;
    return data as string;
  },

  /**
   * Mark all messages in a room as read for the current user.
   */
  async markAsRead(roomId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('chat_room_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id);
  },

  /**
   * Subscribe to new incoming messages.
   */
  subscribeToNewMessages(callback: (msg: ChatMessage) => void) {
    return supabase
      .channel('chat_messages_all')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const newMessage = payload.new as any;

          // Note: we use a ref or functional update to access latest rooms if needed, 
          // but for sender lookup we might need to fetch profile if not in current list context.
          // For now, let's just fetch sender profile if missing or rely on optimistic UI.
          
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, nome, avatar_url, email_login, ativo, created_at, cargo')
            .eq('id', newMessage.sender_id)
            .single();
          
          const enrichedMessage: ChatMessage = {
            ...newMessage,
            sender: senderProfile as any // Cast to avoid strict type check if some fields are null
          };

          callback(enrichedMessage);
        }
      )
      .subscribe();
  }
};
