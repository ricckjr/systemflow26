import { Profile } from './auth';

export type ChatRoomType = 'direct' | 'group' | 'crm_deal';
export type ChatMessageType = 'text' | 'image' | 'file' | 'audio';

export interface ChatAttachment {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  path?: string;
  name: string;
  size?: number;
  mime_type?: string;
}

export interface ChatRoom {
  id: string;
  created_at: string;
  updated_at?: string;
  type: ChatRoomType;
  name?: string;
  description?: string;
  avatar_path?: string | null;
  avatar_url?: string | null;
  created_by: string;
  metadata?: Record<string, any>;
  last_message_at: string;
  // Computed/Joined fields
  members?: ChatRoomMember[];
  unread_count?: number;
  last_message?: ChatMessage;
}

export interface ChatRoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
  last_read_at?: string;
  hidden_at?: string | null;
  cleared_at?: string | null;
  role: 'owner' | 'admin' | 'member';
  // Joined profile
  profile?: Profile;
}

export interface ChatMessageReceipt {
  user_id: string;
  delivered_at?: string | null;
  read_at?: string | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  message_type?: ChatMessageType;
  created_at: string;
  updated_at?: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  is_edited: boolean;
  attachments?: ChatAttachment[];
  reply_to_id?: string | null;
  // Joined sender
  sender?: Profile;
  receipts?: ChatMessageReceipt[];
}
