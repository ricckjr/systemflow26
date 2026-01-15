import { Profile } from './auth';

export type ChatRoomType = 'direct' | 'group' | 'crm_deal';

export interface ChatRoom {
  id: string;
  created_at: string;
  updated_at?: string;
  type: ChatRoomType;
  name?: string;
  description?: string;
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
  role: 'owner' | 'admin' | 'member';
  // Joined profile
  profile?: Profile;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  is_edited: boolean;
  attachments?: any[]; // Define attachment type if needed
  reply_to_id?: string;
  // Joined sender
  sender?: Profile;
}
