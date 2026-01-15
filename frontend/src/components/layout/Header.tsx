import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronRight, ChevronLeft, Bell, MessageSquare, X, Check, Inbox } from 'lucide-react';
import { Profile } from '@/types';
import { supabase } from '@/services/supabase';

interface HeaderProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  profile: Profile;
  supabaseConnected: boolean;
  errorMessage?: string;
}

interface Notification {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  link: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
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
  
  // Notification State (System Alerts)
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Chat Notification State
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isChatNotificationsOpen, setIsChatNotificationsOpen] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<any[]>([]);
  const chatNotificationRef = useRef<HTMLDivElement>(null);

  // ... (keep fetchUnreadChat and subscriptions)

  // Fetch recent chat notifications for the list
  useEffect(() => {
    if (isChatNotificationsOpen && profile?.id) {
       (async () => {
         const { data } = await supabase
           .from('chat_notifications')
           .select(`
             id, is_read, created_at,
             sender:profiles(id, nome, avatar_url),
             message:chat_messages(content)
           `)
           .eq('user_id', profile.id)
           .order('created_at', { ascending: false })
           .limit(10);
         
         if (data) setChatNotifications(data);
       })();
    }
  }, [isChatNotificationsOpen, profile?.id]);

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
    // Navigate to chat
    navigate('/app/comunicacao/chat');
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

  // Fetch Notifications
  useEffect(() => {
    if (!profile?.id) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    const fetchUnreadChat = async () => {
        try {
          if (!profile?.id) return;

          const { data: rpcCount, error: rpcError } = await supabase.rpc('get_unread_chat_notification_count');
          if (!rpcError && typeof rpcCount === 'number') {
            setUnreadChatCount(rpcCount);
            return;
          }

          const { data, error } = await supabase
            .from('chat_notifications')
            .select('id')
            .eq('user_id', profile.id)
            .eq('is_read', false);

          if (!error) {
            setUnreadChatCount(data?.length || 0);
          } else {
            if (error.code !== 'PGRST116' && error.message !== 'FetchError: The user aborted a request.') {
              console.warn('⚠️ Falha ao carregar notificações de chat:', error.message);
            }
          }
        } catch (err) {
          // Silencioso
        }
    };

    fetchNotifications();
    fetchUnreadChat();

    // Subscribe to new notifications
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    // Subscribe to new chat notifications (only count update)
    const chatSubscription = supabase
      .channel('chat_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_notifications',
          filter: `user_id=eq.${profile.id}`
        },
        () => {
           setUnreadChatCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
           event: 'UPDATE',
           schema: 'public',
           table: 'chat_notifications',
           filter: `user_id=eq.${profile.id}`
        },
        () => {
           // Re-fetch to be accurate on read status change
           fetchUnreadChat();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      chatSubscription.unsubscribe();
    };
  }, [profile?.id]);

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

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
      
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    setIsNotificationsOpen(false);

    // Navigate
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <header className="h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 bg-[#0B0F14]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0B0F14]/60 relative z-50">
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
          <div 
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0F172A] border border-white/10"
            title={supabaseConnected ? 'Banco de Dados Online' : 'Banco de Dados Offline'}
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
          </div>

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
                              {new Date(notification.created_at).toLocaleDateString()} • {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              {unreadChatCount > 0 && (
                 <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full border-2 border-[#0B0F14] flex items-center justify-center text-[9px] font-bold text-white animate-pulse">
                   {unreadChatCount > 9 ? '9+' : unreadChatCount}
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
                        <button
                          key={notif.id}
                          onClick={() => handleChatNotificationClick(notif)}
                          className={`w-full p-3 text-left hover:bg-white/5 transition-colors flex gap-3 ${!notif.is_read ? 'bg-cyan-500/5' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center shrink-0 border border-white/10 overflow-hidden">
                             {notif.sender?.avatar_url ? (
                               <img src={notif.sender.avatar_url} className="w-full h-full object-cover" />
                             ) : (
                               <span className="text-[10px] font-bold text-white">{notif.sender?.nome?.substring(0, 2).toUpperCase()}</span>
                             )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                               <p className={`text-xs truncate ${!notif.is_read ? 'text-white font-bold' : 'text-[#E5E7EB]'}`}>
                                 {notif.sender?.nome}
                               </p>
                               <span className="text-[9px] text-[#6B7280]">
                                 {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                            </div>
                            <p className="text-[11px] text-[#9CA3AF] line-clamp-1 truncate">
                              {notif.message?.content || 'Nova mensagem'}
                            </p>
                          </div>
                          {!notif.is_read && (
                             <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2 shrink-0"></div>
                          )}
                        </button>
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
