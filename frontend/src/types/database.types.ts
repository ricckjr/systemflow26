export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      taskflow_boards: {
        Row: {
          id: string
          name: string
          created_at: string
          created_by: string
          company_id: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          created_by: string
          company_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          created_by?: string
          company_id?: string | null
        }
      }
      taskflow_columns: {
        Row: {
          id: string
          board_id: string
          name: string
          order_index: number
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          order_index: number
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          order_index?: number
          created_at?: string
          created_by?: string
        }
      }
      taskflow_tasks: {
        Row: {
          id: string
          board_id: string
          column_id: string
          title: string
          description: string | null
          priority: string
          due_date: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          board_id: string
          column_id: string
          title: string
          description?: string | null
          priority?: string
          due_date?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          board_id?: string
          column_id?: string
          title?: string
          description?: string | null
          priority?: string
          due_date?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string
        }
      }
      taskflow_task_users: {
        Row: {
          id: string
          task_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          role: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
      }
      taskflow_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
      }
      taskflow_activity_log: {
        Row: {
          id: string
          task_id: string
          user_id: string
          type: string
          details: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          type: string
          details?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          type?: string
          details?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string | null
          link: string | null
          type: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content?: string | null
          link?: string | null
          type: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string | null
          link?: string | null
          type?: string
          is_read?: boolean
          created_at?: string
        }
      }
      taskflow_calendar: {
        Row: {
          id: string
          user_id: string
          start_at: string
          end_at: string
          created_at: string
          task_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          start_at: string
          end_at: string
          created_at?: string
          task_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          start_at?: string
          end_at?: string
          created_at?: string
          task_id?: string | null
        }
      }
      taskflow_attachments: {
        Row: {
          id: string
          task_id: string
          file_name: string
          file_url: string
          file_type: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          file_name: string
          file_url: string
          file_type: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          file_name?: string
          file_url?: string
          file_type?: string
          created_by?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          nome: string
          avatar_url: string | null
          ativo: boolean
        }
        Insert: {
          id: string
          nome: string
          avatar_url?: string | null
          ativo?: boolean
        }
        Update: {
          id?: string
          nome?: string
          avatar_url?: string | null
          ativo?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
