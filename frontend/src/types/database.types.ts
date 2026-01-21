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
      crm_ligacoes: {
        Row: {
          id: string
          data_hora: string
          vendedor: string | null
          resultado: string | null
        }
        Insert: {
          id?: string
          data_hora: string
          vendedor?: string | null
          resultado?: string | null
        }
        Update: {
          id?: string
          data_hora?: string
          vendedor?: string | null
          resultado?: string | null
        }
        Relationships: []
      }
      crm_oportunidades: {
        Row: {
          id_oportunidade: string
          cod_oportunidade: string | null
          cliente: string | null
          nome_contato: string | null
          telefone01_contato: string | null
          telefone02_contato: string | null
          email: string | null
          id_vendedor: string | null
          vendedor: string | null
          solucao: string | null
          origem: string | null
          etapa: string | null
          status: string | null
          temperatura: number | null
          valor_proposta: string | null
          descricao_oportunidade: string | null
          observacoes_vendedor: string | null
          empresa_correspondente: string | null
          data_inclusao: string | null
          data: string | null
          dias_abertos: number | null
          dias_parado: number | null
          criado_em: string | null
          atualizado_em: string | null
          system_nota: string | null
        }
        Insert: {
          id_oportunidade?: string
          cod_oportunidade?: string | null
          cliente?: string | null
          nome_contato?: string | null
          telefone01_contato?: string | null
          telefone02_contato?: string | null
          email?: string | null
          id_vendedor?: string | null
          vendedor?: string | null
          solucao?: string | null
          origem?: string | null
          etapa?: string | null
          status?: string | null
          temperatura?: number | null
          valor_proposta?: string | null
          descricao_oportunidade?: string | null
          observacoes_vendedor?: string | null
          empresa_correspondente?: string | null
          data_inclusao?: string | null
          data?: string | null
          dias_abertos?: number | null
          dias_parado?: number | null
          criado_em?: string | null
          atualizado_em?: string | null
          system_nota?: string | null
        }
        Update: {
          id_oportunidade?: string
          cod_oportunidade?: string | null
          cliente?: string | null
          nome_contato?: string | null
          telefone01_contato?: string | null
          telefone02_contato?: string | null
          email?: string | null
          id_vendedor?: string | null
          vendedor?: string | null
          solucao?: string | null
          origem?: string | null
          etapa?: string | null
          status?: string | null
          temperatura?: number | null
          valor_proposta?: string | null
          descricao_oportunidade?: string | null
          observacoes_vendedor?: string | null
          empresa_correspondente?: string | null
          data_inclusao?: string | null
          data?: string | null
          dias_abertos?: number | null
          dias_parado?: number | null
          criado_em?: string | null
          atualizado_em?: string | null
          system_nota?: string | null
        }
        Relationships: []
      }
      crm_pabx_ligacoes: {
        Row: {
          id_user: string
          vendedor: string
          id_data: string
          ligacoes_feitas: number
          ligacoes_nao_atendidas: number
          updated_at: string
        }
        Insert: {
          id_user: string
          vendedor: string
          id_data: string
          ligacoes_feitas: number
          ligacoes_nao_atendidas: number
          updated_at?: string
        }
        Update: {
          id_user?: string
          vendedor?: string
          id_data?: string
          ligacoes_feitas?: number
          ligacoes_nao_atendidas?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_meta_comercial: {
        Row: {
          id: number
          meta_valor_financeiro: number
          supermeta_valor_financeiro: number
          meta_novas_oportunidades: number
          meta_ligacoes: number
          tempo_ligacoes: number | null
          meta_geral: string | null
        }
        Insert: {
          id?: number
          meta_valor_financeiro?: number
          supermeta_valor_financeiro?: number
          meta_novas_oportunidades?: number
          meta_ligacoes?: number
          tempo_ligacoes?: number | null
          meta_geral?: string | null
        }
        Update: {
          id?: number
          meta_valor_financeiro?: number
          supermeta_valor_financeiro?: number
          meta_novas_oportunidades?: number
          meta_ligacoes?: number
          tempo_ligacoes?: number | null
          meta_geral?: string | null
        }
        Relationships: []
      }
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
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "taskflow_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "taskflow_boards"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "taskflow_tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "taskflow_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taskflow_tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "taskflow_columns"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "taskflow_task_users_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "taskflow_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taskflow_task_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "taskflow_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "taskflow_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taskflow_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "taskflow_activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "taskflow_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taskflow_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "taskflow_calendar_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taskflow_calendar_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "taskflow_tasks"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "taskflow_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "taskflow_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taskflow_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          nome: string
          email_login: string
          email_corporativo: string | null
          telefone: string | null
          ramal: string | null
          ativo: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string | null
          cargo: string | null
        }
        Insert: {
          id: string
          nome: string
          email_login: string
          email_corporativo?: string | null
          telefone?: string | null
          ramal?: string | null
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string | null
          cargo?: string | null
        }
        Update: {
          id?: string
          nome?: string
          email_login?: string
          email_corporativo?: string | null
          telefone?: string | null
          ramal?: string | null
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string | null
          cargo: string | null
        }
        Relationships: []
      }
      permissoes: {
        Row: {
          id: string
          modulo: string
          submodulo: string
          descricao: string | null
        }
        Insert: {
          id?: string
          modulo: string
          submodulo: string
          descricao?: string | null
        }
        Update: {
          id?: string
          modulo?: string
          submodulo?: string
          descricao?: string | null
        }
        Relationships: []
      }
      profile_permissoes: {
        Row: {
          profile_id: string
          permissao_id: string
          visualizar: boolean
          editar: boolean
          excluir: boolean
        }
        Insert: {
          profile_id: string
          permissao_id: string
          visualizar?: boolean
          editar?: boolean
          excluir?: boolean
        }
        Update: {
          profile_id?: string
          permissao_id?: string
          visualizar?: boolean
          editar?: boolean
          excluir?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_permissoes_permissao_id_fkey"
            columns: ["permissao_id"]
            isOneToOne: false
            referencedRelation: "permissoes"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_rooms: {
        Row: {
          id: string
          created_at: string
          updated_at: string | null
          type: string
          name: string | null
          description: string | null
          created_by: string
          metadata: Json | null
          last_message_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string | null
          type: string
          name?: string | null
          description?: string | null
          created_by: string
          metadata?: Json | null
          last_message_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string | null
          type?: string
          name?: string | null
          description?: string | null
          created_by?: string
          metadata?: Json | null
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_room_members: {
        Row: {
          room_id: string
          user_id: string
          role: string
          joined_at: string
          last_read_at: string | null
        }
        Insert: {
          room_id: string
          user_id: string
          role?: string
          joined_at?: string
          last_read_at?: string | null
        }
        Update: {
          room_id?: string
          user_id?: string
          role?: string
          joined_at?: string
          last_read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          room_id: string
          sender_id: string
          content: string | null
          created_at: string
          updated_at: string | null
          edited_at: string | null
          deleted_at: string | null
          is_edited: boolean
          attachments: Json[] | null
          reply_to_id: string | null
        }
        Insert: {
          id?: string
          room_id: string
          sender_id: string
          content?: string | null
          created_at?: string
          updated_at?: string | null
          edited_at?: string | null
          deleted_at?: string | null
          is_edited?: boolean
          attachments?: Json[] | null
          reply_to_id?: string | null
        }
        Update: {
          id?: string
          room_id?: string
          sender_id?: string
          content?: string | null
          created_at?: string
          updated_at?: string | null
          edited_at?: string | null
          deleted_at?: string | null
          is_edited?: boolean
          attachments?: Json[] | null
          reply_to_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_message_pins: {
        Row: {
          id: string
          room_id: string
          message_id: string
          pinned_by: string | null
          pinned_at: string
        }
        Insert: {
          id?: string
          room_id: string
          message_id: string
          pinned_by?: string | null
          pinned_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          message_id?: string
          pinned_by?: string | null
          pinned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_pins_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_pins_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_message_reactions: {
        Row: {
          room_id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          room_id: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          room_id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_notifications: {
        Row: {
          id: string
          user_id: string
          room_id: string
          message_id: string
          sender_id: string
          type: 'message' | 'mention' | 'reply'
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          room_id: string
          message_id: string
          sender_id: string
          type?: 'message' | 'mention' | 'reply'
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          room_id?: string
          message_id?: string
          sender_id?: string
          type?: 'message' | 'mention' | 'reply'
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_notifications_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      omie_servics: {
        Row: {
          id_omie: string
          cod_proposta: string
          solucao: string | null
          vendedor: string | null
          cliente: string | null
          cnpj: string | null
          endereco: string | null
          etapa: string | null
          status: string | null
          valor_proposta: number
          descricao_servico: string | null
          observacoes: string | null
          data_inclusao: string | null
          data_alteracao: string | null
          data_entrega: string | null
        }
        Insert: {
          id_omie: string
          cod_proposta: string
          solucao?: string | null
          vendedor?: string | null
          cliente?: string | null
          cnpj?: string | null
          endereco?: string | null
          etapa?: string | null
          status?: string | null
          valor_proposta?: number
          descricao_servico?: string | null
          observacoes?: string | null
          data_inclusao?: string | null
          data_alteracao?: string | null
          data_entrega?: string | null
        }
        Update: {
          id_omie?: string
          cod_proposta?: string
          solucao?: string | null
          vendedor?: string | null
          cliente?: string | null
          cnpj?: string | null
          endereco?: string | null
          etapa?: string | null
          status?: string | null
          valor_proposta?: number
          descricao_servico?: string | null
          observacoes?: string | null
          data_inclusao?: string | null
          data_alteracao?: string | null
          data_entrega?: string | null
        }
        Relationships: []
      }
      servics_equipamento: {
        Row: {
          id: string
          id_rst: string
          cod_proposta: string
          cliente: string
          cnpj: string | null
          endereco: string | null
          modelo: string | null
          fabricante: string | null
          numero_serie: string | null
          tag: string | null
          garantia: boolean
          faixa: string | null
          observacoes_equipamento: string | null
          imagens: string[] | null // Stored as jsonb
          data_entrada: string
          data_finalizada: string | null
          fase: string
          responsavel: string | null
          solucao: string | null
          numero_nf: string | null
          numero_pedido: string | null
          etapa_omie: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          // id_rst is generated by DB trigger
          cod_proposta: string
          cliente: string
          cnpj?: string | null
          endereco?: string | null
          numero_nf?: string | null
          numero_pedido?: string | null
          modelo?: string | null
          fabricante?: string | null
          numero_serie?: string | null
          tag?: string | null
          garantia?: boolean
          faixa?: string | null
          observacoes_equipamento?: string | null
          imagens?: string[] | null
          data_entrada?: string
          data_finalizada?: string | null
          fase?: string
          responsavel?: string | null
          solucao?: string | null
          etapa_omie?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          // id_rst should not be updated usually
          cod_proposta?: string
          cliente?: string
          cnpj?: string | null
          endereco?: string | null
          numero_nf?: string | null
          numero_pedido?: string | null
          modelo?: string | null
          fabricante?: string | null
          numero_serie?: string | null
          tag?: string | null
          garantia?: boolean
          faixa?: string | null
          observacoes_equipamento?: string | null
          imagens?: string[] | null
          data_entrada?: string
          data_finalizada?: string | null
          fase?: string
          responsavel?: string | null
          solucao?: string | null
          etapa_omie?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_or_create_direct_chat: {
        Args: {
          other_user_id: string
        }
        Returns: string
      }
      get_unread_chat_notification_count: {
        Args: Record<string, never>
        Returns: number
      }
      mark_all_delivered: {
        Args: Record<string, never>
        Returns: void
      }
      mark_message_delivered: {
        Args: {
          message_id: string
        }
        Returns: void
      }
      mark_room_read: {
        Args: {
          room_id: string
        }
        Returns: void
      }
      update_user_status: {
        Args: {
          new_status: string
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
