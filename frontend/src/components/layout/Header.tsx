import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronRight, ChevronLeft, Bell, MessageSquare, Check, Inbox } from 'lucide-react';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
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
  const { session } = useAuth()
  const userId = session?.user?.id ?? profile?.id ?? null
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  
  // Notification UI State (System Alerts)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);


  const getPageTitle = () => {
    const map: Record<string, string> = {
      '/app/comunidade': 'COMUNIDADE',
      '/app/comunidade/chat': 'CHAT',
      '/app/comunidade/taskflow': 'TAREFAS',
      '/app/comunidade/calendario': 'CALENDÁRIO',
      '/app/dashboard/comercial': 'COMERCIAL',

      '/app/crm/oportunidades-kanban': 'CRM — OPORTUNIDADES (KANBAN)',
      '/app/crm/oportunidades': 'CRM — OPORTUNIDADES (KANBAN)',
      '/app/crm/propostas': 'CRM — OPORTUNIDADES (KANBAN)',
      '/app/crm/ranking': 'CRM — RANKING',
      '/app/crm/vendedores': 'CRM — RANKING',
      '/app/crm/clientes': 'CRM — CLIENTES',

      '/app/cadastros/clientes': 'CRM — CLIENTES',
      '/app/cadastros/contatos': 'CRM — CLIENTES',
      '/app/cadastros/fornecedores': 'CRM — CLIENTES',

      '/app/crm/configs/origem-leads': 'CONFIG GERAIS — ORIGEM DE LEADS',
      '/app/crm/configs/motivos': 'CONFIG GERAIS — MOTIVOS',
      '/app/crm/configs/verticais': 'CONFIG GERAIS — VERTICAIS',
      '/app/crm/configs/produtos': 'CONFIG GERAIS — PRODUTOS',
      '/app/crm/configs/servicos': 'CONFIG GERAIS — SERVIÇOS',
      '/app/config-gerais/transportadora': 'CONFIG GERAIS — TRANSPORTADORA',

      '/app/comercial/overview': 'COMERCIAL',
      '/app/comercial/vendedores': 'CRM — RANKING',
      '/app/comercial/oportunidades': 'CRM — OPORTUNIDADES (KANBAN)',
      '/app/comunicacao/chat': 'CHAT',
      '/app/comunicacao/flowsmart': 'SMARTFLOW — ATENDIMENTOS',
      '/app/comunicacao/ia': 'ASSISTENTE FLOW',

      '/app/smartflow/atendimentos': 'SMARTFLOW — ATENDIMENTOS',
      '/app/smartflow/kanban-fluxos': 'SMARTFLOW — KANBAN DE FLUXOS',

      '/app/producao/propostas': 'PRODUÇÃO — PROPOSTAS',
      '/app/producao/omie': 'PRODUÇÃO — PROPOSTAS',
      '/app/producao/ordens-servico': 'PRODUÇÃO — KANBAN PRODUÇÃO',
      '/app/producao/servicos': 'PRODUÇÃO — KANBAN PRODUÇÃO',
      '/app/producao/equipamentos': 'PRODUÇÃO — EQUIPAMENTOS',
      '/app/producao/certificado-garantia': 'PRODUÇÃO — CERTIFICADO GARANTIA',
      '/app/configuracoes/perfil': 'PERFIL',
      '/app/configuracoes/usuarios': 'CONFIG GERAIS — USUÁRIOS',
      '/app/configuracoes/permissoes': 'CONFIG GERAIS — PERMISSÕES',
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
                      {notifications.map((notification) => {
                        const isChat = String(notification?.type || '').toLowerCase() === 'chat'
                        const Icon = isChat ? MessageSquare : Bell
                        const bgUnread = isChat ? 'bg-violet-500/5' : 'bg-cyan-500/5'
                        const dotUnread = isChat ? 'bg-violet-500' : 'bg-cyan-500'

                        return (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full p-3 text-left hover:bg-white/5 transition-colors flex gap-3 ${!notification.is_read ? bgUnread : ''}`}
                          >
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notification.is_read ? dotUnread : 'bg-transparent'}`}></div>

                            <div className={`mt-0.5 w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center shrink-0 ${isChat ? 'bg-violet-500/10 text-violet-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
                              <Icon size={16} />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-xs ${!notification.is_read ? 'text-white font-semibold' : 'text-[#E5E7EB]'}`}>
                                  {notification.title}
                                </p>
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isChat ? 'bg-violet-500/10 text-violet-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
                                  {isChat ? 'Chat' : 'Sistema'}
                                </span>
                              </div>

                              {notification.content && (
                                <p className="text-[11px] text-[#9CA3AF] line-clamp-2 leading-relaxed mt-1">
                                  {notification.content}
                                </p>
                              )}

                              <p className="text-[9px] text-[#6B7280] mt-1.5 font-medium">
                                {formatDateBR(notification.created_at)} • {formatTimeBR(notification.created_at)}
                              </p>
                            </div>
                          </button>
                        )
                      })}
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
