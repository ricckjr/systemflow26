export interface Post {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  content: string;
  image_url?: string;
  likes: number;
  comments_count: number;
  created_at: string;
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
  type: 'instaflow' | 'taskflow' | 'system';
  entity_type?: 'post' | 'task' | 'comment';
  entity_id?: string;
  title: string;
  message?: string;
  content?: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}
