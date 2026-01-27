import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronRight, ChevronLeft, Bell, MessageSquare, X, Check, Inbox } from 'lucide-react';
import { Profile } from '@/types';
import { supabase } from '@/services/supabase';
import { useChatNotifications } from '@/contexts/ChatNotificationsContext';
import { useSystemNotifications } from '@/contexts/SystemNotificationsContext';
import { formatDateBR, formatTimeBR } from '@/utils/datetime';

interface HeaderProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  profile: Profile;
  supabaseConnected: boolean;
  errorMessage?: string;
}

type ChatNotifMessage = {
  id: string
  content: string | null
  attachments?: any[] | null
}

type ChatNotifSender = {
  id: string
  nome: string | null
  avatar_url: string | null
}

type ChatNotifItem = {
  id: string
  room_id: string
  message_id: string
  sender_id: string
  is_read: boolean
  created_at: string
  sender?: ChatNotifSender | null
  message?: ChatNotifMessage | null
}

export const Header: React.FC<HeaderProps> = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isCollapsed,
  setIsCollapsed,
  profile,
  supabaseConnected,
  errorMessage
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { totalUnread } = useChatNotifications();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useSystemNotifications()
  
  // Notification UI State (System Alerts)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Chat Notification State
  const [isChatNotificationsOpen, setIsChatNotificationsOpen] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<ChatNotifItem[]>([]);
  const chatNotificationRef = useRef<HTMLDivElement>(null);

  // ... (keep fetchUnreadChat and subscriptions)

  // Fetch recent chat notifications for the list
  useEffect(() => {
    if (isChatNotificationsOpen && profile?.id) {
      ;(async () => {
        const { data: notifRows } = await supabase
          .from('chat_notifications')
          .select('id, room_id, message_id, sender_id, is_read, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(10)

        const base = (notifRows ?? []) as any[]
        if (base.length === 0) {
          setChatNotifications([])
          return
        }

        const senderIds = Array.from(
          new Set(base.map((r) => r?.sender_id).filter(Boolean))
        ) as string[]
        const messageIds = Array.from(
          new Set(base.map((r) => r?.message_id).filter(Boolean))
        ) as string[]

        const [{ data: senders }, { data: messages }] = await Promise.all([
          supabase.from('profiles').select('id, nome, avatar_url').in('id', senderIds),
          supabase.from('chat_messages').select('id, content, attachments').in('id', messageIds),
        ])

        const senderById = new Map<string, ChatNotifSender>()
        for (const s of (senders ?? []) as any[]) {
          if (!s?.id) continue
          senderById.set(s.id, {
            id: s.id,
            nome: s.nome ?? null,
            avatar_url: s.avatar_url ?? null,
          })
        }

        const messageById = new Map<string, ChatNotifMessage>()
        for (const m of (messages ?? []) as any[]) {
          if (!m?.id) continue
          messageById.set(m.id, {
            id: m.id,
            content: typeof m.content === 'string' ? m.content : null,
            attachments: m.attachments ?? null,
          })
        }

        const items: ChatNotifItem[] = base
          .filter((r) => r?.id && r?.room_id && r?.message_id && r?.sender_id)
          .map((r) => ({
            id: r.id,
            room_id: r.room_id,
            message_id: r.message_id,
            sender_id: r.sender_id,
            is_read: Boolean(r.is_read),
            created_at: r.created_at,
            sender: senderById.get(r.sender_id) ?? null,
            message: messageById.get(r.message_id) ?? null,
          }))

        setChatNotifications(items)
      })()
    }
  }, [isChatNotificationsOpen, profile?.id, totalUnread]);

  useEffect(() => {
    if (!isChatNotificationsOpen || !profile?.id) return

    const channel = supabase
      .channel(`chat_notifications_dropdown_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        async (payload) => {
          const row = payload.new as any
          const id = row?.id as string | undefined
          const roomId = row?.room_id as string | undefined
          const messageId = row?.message_id as string | undefined
          const senderId = row?.sender_id as string | undefined
          if (!id || !roomId || !messageId || !senderId) return

          const [{ data: sender }, { data: message }] = await Promise.all([
            supabase.from('profiles').select('id, nome, avatar_url').eq('id', senderId).single(),
            supabase.from('chat_messages').select('id, content, attachments').eq('id', messageId).single(),
          ])

          const nextItem: ChatNotifItem = {
            id,
            room_id: roomId,
            message_id: messageId,
            sender_id: senderId,
            is_read: Boolean(row?.is_read),
            created_at: row?.created_at,
            sender: sender
              ? { id: sender.id, nome: sender.nome ?? null, avatar_url: sender.avatar_url ?? null }
              : null,
            message: message
              ? { id: message.id, content: typeof message.content === 'string' ? message.content : null, attachments: message.attachments ?? null }
              : null,
          }

          setChatNotifications((prev) => {
            const filtered = prev.filter((x) => x.id !== id)
            return [nextItem, ...filtered].slice(0, 10)
          })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [isChatNotificationsOpen, profile?.id])

  // Click outside for chat notifications
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatNotificationRef.current && !chatNotificationRef.current.contains(event.target as Node)) {
        setIsChatNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChatNotificationClick = async (notif: any) => {
    const roomId = notif?.room_id as string | undefined
    const messageId = notif?.message_id as string | undefined
    const qs = roomId
      ? messageId
        ? `?room=${encodeURIComponent(roomId)}&message=${encodeURIComponent(messageId)}`
        : `?room=${encodeURIComponent(roomId)}`
      : ''
    navigate(`/app/comunicacao/chat${qs}`)
    setIsChatNotificationsOpen(false);
    // Mark as read happens automatically in the chat page or we can do it here
  };


  const getPageTitle = () => {
    const map: Record<string, string> = {
      '/app/comunidade': 'COMUNIDADE FLOW',
      '/app/comunidade/taskflow': 'TASKFLOW',
      '/app/comercial/overview': 'VISÃO COMERCIAL',
      '/app/comercial/vendedores': 'VENDEDORES',
      '/app/comercial/oportunidades': 'OPORTUNIDADES',
      '/app/comunicacao/chat': 'COMUNICAÇÃO',
      '/app/comunicacao/flowsmart': 'FLOWSMART',
      '/app/comunicacao/ia': 'ASSISTENTE FLOW',
      '/app/producao/propostas': 'PRODUÇÃO — PROPOSTAS',
      '/app/producao/omie': 'PRODUÇÃO — PROPOSTAS',
      '/app/producao/ordens-servico': 'PRODUÇÃO — ORDENS DE SERVIÇO',
      '/app/producao/servicos': 'PRODUÇÃO — ORDENS DE SERVIÇO',
      '/app/producao/equipamentos': 'PRODUÇÃO — EQUIPAMENTOS',
      '/app/configuracoes/perfil': 'PERFIL',
      '/app/configuracoes/usuarios': 'USUÁRIOS',
      '/app/configuracoes/permissoes': 'PERMISSÕES',
    };

    return (
      map[location.pathname] ||
      location.pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/-/g, ' ')
        .toUpperCase() ||
      'DASHBOARD'
    );
  };

  // Click outside to close notifications
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: any) => {
    const id = notification?.id as string | undefined
    if (!id) return
    if (!notification.is_read) await markAsRead(id)
    setIsNotificationsOpen(false);

    // Navigate
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <header className="h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 bg-[#0B0F14]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0B0F14]/60 fixed top-0 left-0 right-0 lg:left-20 z-50">
      {/* LEFT */}
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 rounded-md text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5 transition"
          aria-label="Abrir menu"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>

        {/* Collapse sidebar */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex p-2 rounded-md text-[#9CA3AF] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 transition"
          aria-label="Expandir/recolher sidebar"
        >
          {isCollapsed ? (
            <ChevronRight size={18} strokeWidth={1.5} />
          ) : (
            <ChevronLeft size={18} strokeWidth={1.5} />
          )}
        </button>

        {/* Page title */}
        <h1 className="ml-2 text-[13px] font-semibold tracking-wide text-[#E5E7EB]">
          {getPageTitle()}
        </h1>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-4">
        {/* Error message */}
        {errorMessage && (
          <div className="px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium">
            {errorMessage}
          </div>
        )}

        {/* Status / Notifications / Chat */}
        <div className="flex items-center gap-3 pr-4 border-r border-white/10">
          {/* Supabase Status */}
          <button 
            onClick={() => navigate('/app/infra/supabase')}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0F172A] border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all cursor-pointer"
            title={supabaseConnected ? 'Monitoramento de Infraestrutura' : 'Banco de Dados Offline'}
          >
             <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 ${supabaseConnected ? 'text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.5)]' : 'text-red-500'}`}
            >
              <path
                d="M11.6667 0.0833282C10.0333 0.0833282 8.7 1.41666 8.7 3.04999V9.58333H3.66667C2.96667 9.58333 2.53333 10.3667 2.91667 10.9333L10.3333 22.8667C10.9167 23.8 12.3 23.3833 12.3 22.2833V14.4167H17.3333C18.0333 14.4167 18.4667 13.6333 18.0833 13.0667L12.3 0.0833282H11.6667Z"
                fill="currentColor"
              />
            </svg>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${isNotificationsOpen ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-[#0F172A] border-white/10 text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5'}`}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#0B0F14] flex items-center justify-center text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute top-12 right-0 w-80 bg-[#0F172A] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[#131B2C]">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Bell size={14} className="text-cyan-400" />
                    Notificações
                  </h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                    >
                      <Check size={12} /> Marcar lidas
                    </button>
                  )}
                </div>
                
                <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-[#9CA3AF] flex flex-col items-center gap-3">
                      <Inbox size={32} className="opacity-20" />
                      <p className="text-xs">Nenhuma notificação.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {notifications.map(notification => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full p-3 text-left hover:bg-white/5 transition-colors flex gap-3 ${!notification.is_read ? 'bg-cyan-500/5' : ''}`}
                        >
                          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notification.is_read ? 'bg-cyan-500' : 'bg-transparent'}`}></div>
                          <div>
                            <p className={`text-xs mb-1 ${!notification.is_read ? 'text-white font-semibold' : 'text-[#E5E7EB]'}`}>
                              {notification.title}
                            </p>
                            {notification.content && (
                              <p className="text-[11px] text-[#9CA3AF] line-clamp-2 leading-relaxed">
                                {notification.content}
                              </p>
                            )}
                            <p className="text-[9px] text-[#6B7280] mt-1.5 font-medium">
                              {formatDateBR(notification.created_at)} • {formatTimeBR(notification.created_at)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Chat Notifications */}
          <div className="relative" ref={chatNotificationRef}>
            <button 
              onClick={() => setIsChatNotificationsOpen(!isChatNotificationsOpen)}
              className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${isChatNotificationsOpen ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-[#0F172A] border-white/10 text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5'}`}
              title="Mensagens"
            >
              <MessageSquare size={16} />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full border-2 border-[#0B0F14] flex items-center justify-center text-[9px] font-bold text-[#0B0F14]">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </button>

            {/* Chat Dropdown */}
            {isChatNotificationsOpen && (
              <div className="absolute top-12 right-0 w-80 bg-[#0F172A] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[#131B2C]">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MessageSquare size={14} className="text-cyan-400" />
                    Mensagens
                  </h3>
                  <button 
                    onClick={() => navigate('/app/comunicacao/chat')}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium hover:underline"
                  >
                    Ver todas
                  </button>
                </div>
                
                <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                  {chatNotifications.length === 0 ? (
                    <div className="p-8 text-center text-[#9CA3AF] flex flex-col items-center gap-3">
                      <Inbox size={32} className="opacity-20" />
                      <p className="text-xs">Nenhuma mensagem recente.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {chatNotifications.map(notif => (
                        (() => {
                          const content = typeof notif?.message?.content === 'string' ? notif.message.content.trim() : ''
                          const attachments = notif?.message?.attachments
                          const hasAttachments = Array.isArray(attachments) && attachments.length > 0
                          const firstType = hasAttachments ? (attachments as any[])[0]?.type : undefined
                          const attachmentPreview =
                            firstType === 'audio'
                              ? '🎵 Áudio'
                              : firstType === 'image'
                                ? '🖼️ Imagem'
                                : firstType === 'video'
                                  ? '🎬 Vídeo'
                                  : firstType === 'document'
                                    ? '📄 Documento'
                                    : hasAttachments
                                      ? '📎 Anexo'
                                      : ''
                          const preview = content || attachmentPreview || 'Nova mensagem'
                          const senderName = (notif?.sender?.nome || 'Alguém').trim?.() ? (notif.sender.nome as any) : 'Alguém'

                          return (
                        <button
                          key={notif.id}
                          onClick={() => handleChatNotificationClick(notif)}
                          className={`w-full p-3 text-left hover:bg-white/5 transition-colors flex gap-3 ${!notif.is_read ? 'bg-cyan-500/5' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center shrink-0 border border-white/10 overflow-hidden">
                             {notif.sender?.avatar_url ? (
                               <img src={notif.sender.avatar_url} className="w-full h-full object-cover" />
                             ) : (
                               <span className="text-[10px] font-bold text-white">{senderName.substring(0, 2).toUpperCase()}</span>
                             )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                               <p className={`text-xs truncate ${!notif.is_read ? 'text-white font-bold' : 'text-[#E5E7EB]'}`}>
                                 {senderName} mandou mensagem
                               </p>
                               <span className="text-[9px] text-[#6B7280]">
                                 {formatTimeBR(notif.created_at)}
                               </span>
                            </div>
                            <p className="text-[11px] text-[#9CA3AF] line-clamp-1 truncate">
                              {preview}
                            </p>
                          </div>
                          {!notif.is_read && (
                             <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2 shrink-0"></div>
                          )}
                        </button>
                          )
                        })()
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Profile */}
        <button 
          onClick={() => navigate('/app/configuracoes/perfil')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
        >
          <div className="hidden sm:block text-right">
            <p className="text-[13px] font-medium text-[#E5E7EB] leading-none">
              {(() => {
                const name = profile?.nome?.trim();
                if (name) return name;
                const email = (profile as any)?.email_login || '';
                const local = typeof email === 'string' ? email.split('@')[0] : '';
                return local || '';
              })()}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-widest font-medium text-[#9CA3AF]">
              {profile?.cargo || ''}
            </p>
          </div>

          <div className="w-8 h-8 rounded-full border border-white/10 bg-[#0F172A] flex items-center justify-center text-[11px] font-semibold text-[#E5E7EB] overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              (() => {
                const name = profile?.nome?.trim();
                const base = name || ((profile as any)?.email_login || '');
                const initial = typeof base === 'string' && base.length > 0 ? base.substring(0, 2) : 'U';
                return initial.toUpperCase();
              })()
            )}
          </div>
        </button>
      </div>
    </header>
  );
};
