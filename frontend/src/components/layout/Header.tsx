import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronRight, ChevronLeft, Bell, MessageSquare, Check, Inbox, Server } from 'lucide-react';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/useNotifications';
import { formatDateBR, formatTimeBR } from '@/utils/datetime';

interface HeaderProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  profile: Profile;
  supabaseConnected: boolean;
  apiConnected: boolean;
  errorMessage?: string;
}

// Maps path to [section, page] tuple for breadcrumb display
const PAGE_MAP: Record<string, [string, string] | [string]> = {
  '/app/comunidade': ['Comunidade', 'Feed'],
  '/app/comunidade/chat': ['Comunidade', 'Chat'],
  '/app/comunidade/taskflow': ['Comunidade', 'Tarefas'],
  '/app/comunidade/calendario': ['Comunidade', 'Calendário'],
  '/app/dashboard/comercial': ['Dashboard', 'Comercial'],

  '/app/crm/propostas-comerciais-kanban': ['CRM', 'Proposta Comercial'],
  '/app/crm/oportunidades-kanban': ['CRM', 'Proposta Comercial'],
  '/app/crm/oportunidades': ['CRM', 'Proposta Comercial'],
  '/app/crm/propostas': ['CRM', 'Proposta Comercial'],
  '/app/crm/propostas-comerciais': ['CRM', 'Proposta Comercial'],
  '/app/crm/ranking': ['CRM', 'Vendedores'],
  '/app/crm/vendedores': ['CRM', 'Vendedores'],
  '/app/crm/clientes': ['CRM', 'Clientes'],

  '/app/crm/configs/origem-leads': ['Config Gerais', 'Origem de Leads'],
  '/app/crm/configs/motivos': ['Config Gerais', 'Motivos'],
  '/app/crm/configs/verticais': ['Config Gerais', 'Verticais'],
  '/app/crm/configs/produtos': ['Config Gerais', 'Produtos'],
  '/app/crm/configs/fases': ['Config Gerais', 'CRM Fases'],
  '/app/crm/configs/status': ['Config Gerais', 'CRM Status'],
  '/app/crm/configs/servicos': ['Compras e Estoque', 'Serviços'],
  '/app/config-gerais/transportadora': ['Config Gerais', 'Transportadora'],

  '/app/smartflow/atendimentos': ['SmartFlow', 'Atendimentos'],
  '/app/smartflow/kanban-fluxos': ['SmartFlow', 'Kanban de Fluxos'],

  '/app/compras-estoque': ['Compras e Estoque'],
  '/app/compras-estoque/compras': ['Compras e Estoque', 'Compras'],
  '/app/compras-estoque/estoque': ['Compras e Estoque', 'Estoque'],
  '/app/compras-estoque/consultar-estoque': ['Compras e Estoque', 'Consultar Estoque'],
  '/app/compras-estoque/locais-estoque': ['Compras e Estoque', 'Locais do Estoque'],
  '/app/compras-estoque/transportadora': ['Compras e Estoque', 'Transportadora'],
  '/app/compras-estoque/servicos': ['Compras e Estoque', 'Serviços'],
  '/app/compras-estoque/ncm': ['Compras e Estoque', 'NCM'],

  '/app/producao/propostas': ['Produção', 'Propostas'],
  '/app/producao/omie': ['Produção', 'Propostas'],
  '/app/producao/ordens-servico': ['Produção', 'Kanban Produção'],
  '/app/producao/servicos': ['Produção', 'Kanban Produção'],
  '/app/producao/equipamentos': ['Produção', 'Equipamentos'],
  '/app/producao/logistica': ['Produção', 'Logística'],
  '/app/producao/certificado-garantia': ['Produção', 'Certificado Garantia'],

  '/app/financeiro/empresas-correspondentes': ['Administrativo', 'Empresa Correspondente'],
  '/app/configuracoes/usuarios': ['Config Gerais', 'Usuários'],
  '/app/configuracoes/perfil': ['Config Gerais', 'Perfil'],
  '/app/configuracoes/permissoes': ['Config Gerais', 'Permissões'],
  '/app/administrativo/colaboradores': ['Administrativo', 'Colaboradores'],

  '/app/frota/veiculos': ['Frota', 'Veículos'],
  '/app/frota/diario-de-bordo': ['Frota', 'Diário de Bordo'],

  '/app/universidade/catalogos': ['Universidade', 'Catálogos'],
  '/app/universidade/manuais': ['Universidade', 'Manuais'],
  '/app/universidade/treinamentos': ['Universidade', 'Treinamentos'],
  '/app/universidade/instrucoes-de-trabalho': ['Universidade', 'Instruções de Trabalho'],
};

export const Header: React.FC<HeaderProps> = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isCollapsed,
  setIsCollapsed,
  profile,
  supabaseConnected,
  apiConnected,
  errorMessage
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const getBreadcrumb = (): [string, string] | [string] | null => {
    return PAGE_MAP[location.pathname] ?? null;
  };

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
    if (notification.link) navigate(notification.link);
  };

  const breadcrumb = getBreadcrumb();
  const profileName = profile?.nome?.trim() || (profile as any)?.email_login?.split('@')[0] || '';
  const profileInitial = profileName ? profileName.substring(0, 2).toUpperCase() : 'U';

  const statusOk = supabaseConnected && apiConnected;
  const statusPartial = supabaseConnected !== apiConnected;

  return (
    <header className="h-14 px-4 flex items-center justify-between shrink-0 border-b border-[var(--border)] bg-[var(--bg-main)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-main)]/70 fixed top-0 left-0 right-0 lg:left-20 z-50">
      {/* LEFT */}
      <div className="flex items-center gap-2">
        {/* Mobile menu */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/[0.06] transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>

        {/* Collapse sidebar */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors"
          aria-label="Expandir/recolher sidebar"
        >
          {isCollapsed ? (
            <ChevronRight size={16} strokeWidth={1.75} />
          ) : (
            <ChevronLeft size={16} strokeWidth={1.75} />
          )}
        </button>

        {/* Divider */}
        <div className="hidden lg:block w-px h-4 bg-[var(--border)]" />

        {/* Breadcrumb */}
        {breadcrumb ? (
          <div className="flex items-center gap-1.5 ml-1">
            {breadcrumb.length === 2 ? (
              <>
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {breadcrumb[0]}
                </span>
                <ChevronRight size={12} className="text-[var(--text-muted)] opacity-40" />
                <span className="text-xs font-semibold text-[var(--text-main)]">
                  {breadcrumb[1]}
                </span>
              </>
            ) : (
              <span className="text-xs font-semibold text-[var(--text-main)]">
                {breadcrumb[0]}
              </span>
            )}
          </div>
        ) : (
          <span className="ml-1 text-xs font-semibold text-[var(--text-main)] uppercase tracking-wide">
            {location.pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Dashboard'}
          </span>
        )}
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">
        {/* Error banner */}
        {errorMessage && (
          <div className="px-3 py-1 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Infrastructure status */}
        <div className="flex items-center gap-1 px-3 border-r border-[var(--border)]">
          <button
            onClick={() => navigate('/app/infra/supabase')}
            className="group relative flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/[0.06] transition-colors"
            title={apiConnected ? 'API Operacional' : 'API Offline'}
          >
            <Server
              size={14}
              className={apiConnected ? 'text-[var(--success)]' : 'text-[var(--danger)]'}
            />
            {!apiConnected && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[var(--danger)] rounded-full" />
            )}
          </button>

          <button
            onClick={() => navigate('/app/infra/supabase')}
            className="group relative flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/[0.06] transition-colors"
            title={supabaseConnected ? 'Banco de Dados Operacional' : 'Banco de Dados Offline'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`w-3.5 h-3.5 ${supabaseConnected ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
            >
              <path
                d="M11.6667 0.0833282C10.0333 0.0833282 8.7 1.41666 8.7 3.04999V9.58333H3.66667C2.96667 9.58333 2.53333 10.3667 2.91667 10.9333L10.3333 22.8667C10.9167 23.8 12.3 23.3833 12.3 22.2833V14.4167H17.3333C18.0333 14.4167 18.4667 13.6333 18.0833 13.0667L12.3 0.0833282H11.6667Z"
                fill="currentColor"
              />
            </svg>
            {!supabaseConnected && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[var(--danger)] rounded-full" />
            )}
          </button>

          {/* Status dot summary */}
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              statusOk ? 'bg-[var(--success)]' : statusPartial ? 'bg-[var(--warning)]' : 'bg-[var(--danger)]'
            }`}
            title={statusOk ? 'Todos os serviços operacionais' : 'Atenção — verifique a infraestrutura'}
          />
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150
              ${isNotificationsOpen
                ? 'bg-[var(--primary-soft)] border-[var(--primary)]/30 text-[var(--primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/[0.06]'
              }`}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[var(--danger)] rounded-full border border-[var(--bg-main)] flex items-center justify-center text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute top-10 right-0 w-80 bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden animate-in slide-in-from-top-1 duration-150 z-50">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-soft)] flex items-center gap-2">
                  <Bell size={12} className="text-[var(--primary)]" />
                  Notificações
                  {unreadCount > 0 && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-[var(--primary)] hover:text-[var(--text-main)] font-medium flex items-center gap-1 transition-colors"
                  >
                    <Check size={11} /> Marcar lidas
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center gap-3">
                    <Inbox size={28} className="text-[var(--text-muted)] opacity-30" />
                    <p className="text-xs text-[var(--text-muted)]">Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {notifications.map((notification) => {
                      const isChat = String(notification?.type || '').toLowerCase() === 'chat'
                      const Icon = isChat ? MessageSquare : Bell
                      const accentColor = isChat ? 'text-violet-400' : 'text-[var(--primary)]'
                      const accentBg = isChat ? 'bg-violet-500/10' : 'bg-[var(--primary-soft)]'
                      const unreadBg = isChat ? 'bg-violet-500/5' : 'bg-[var(--primary-soft)]/50'

                      return (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full px-4 py-3 text-left hover:bg-white/[0.03] transition-colors flex gap-3 ${!notification.is_read ? unreadBg : ''}`}
                        >
                          {/* Unread dot */}
                          <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${!notification.is_read ? (isChat ? 'bg-violet-400' : 'bg-[var(--primary)]') : 'bg-transparent'}`} />

                          {/* Icon */}
                          <div className={`w-7 h-7 rounded-lg border border-[var(--border)] flex items-center justify-center shrink-0 ${accentBg} ${accentColor}`}>
                            <Icon size={13} />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2 justify-between">
                              <p className={`text-xs leading-snug ${!notification.is_read ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-soft)]'}`}>
                                {notification.title}
                              </p>
                              <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${accentBg} ${accentColor}`}>
                                {isChat ? 'Chat' : 'Sistema'}
                              </span>
                            </div>

                            {notification.content && (
                              <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-0.5 leading-relaxed">
                                {notification.content}
                              </p>
                            )}

                            <p className="text-xs text-[var(--text-muted)] mt-1.5 opacity-60">
                              {formatDateBR(notification.created_at)} · {formatTimeBR(notification.created_at)}
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

        {/* Profile */}
        <button
          onClick={() => navigate('/app/configuracoes/perfil')}
          className="flex items-center gap-2.5 pl-2 border-l border-[var(--border)] hover:opacity-80 transition-opacity"
        >
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-[var(--text-main)] leading-none">
              {profileName}
            </p>
            <p className="mt-0.5 text-xs uppercase tracking-widest font-medium text-[var(--text-muted)]">
              {profile?.cargo || ''}
            </p>
          </div>

          <div className="w-7 h-7 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-center text-xs font-bold text-[var(--text-soft)] overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              profileInitial
            )}
          </div>
        </button>
      </div>
    </header>
  );
};
