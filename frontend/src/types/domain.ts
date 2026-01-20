export interface Post {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_avatar_url?: string | null;
  content: string;
  image_url?: string;
  media?: string[];
  reactions?: Record<string, number>;
  my_reaction?: string | null;
  likes: number;
  comments_count: number;
  liked_by_me?: boolean;
  created_at: string;
}

export interface InstaFlowComment {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
  parent_id?: string | null;
  mention_user_ids?: string[];
  usuario_nome: string;
  usuario_avatar_url?: string | null;
}

export interface Opportunity {
  id: string;
  title: string;
  value: number;
  status: 'Lead' | 'Contact' | 'Proposal' | 'Negotiation' | 'Closed';
  seller: string;
  created_at: string;
}

export interface Recognition {
  id: string;
  title: string;
  description?: string;
  user_id: string;
  user_nome?: string;
  created_by: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  task_id?: string;
  user_id: string;
  start_at: string;
  end_at: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  entity_type?: 'post' | 'task' | 'comment';
  entity_id?: string;
  title: string;
  message?: string;
  content?: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}
