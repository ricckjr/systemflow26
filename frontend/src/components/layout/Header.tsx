import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronRight, ChevronLeft, Bell, MessageSquare } from 'lucide-react';
import { Profile } from '@/types';

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

  return (
    <header className="h-16 px-6 flex items-center justify-between shrink-0 border-b border-white/5 bg-[#0B0F14]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0B0F14]/60">
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
          <button className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0F172A] border border-white/10 text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5 transition-colors relative">
            <Bell size={16} />
            {/* Mock Notification Dot */}
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0B0F14]"></span>
          </button>

          {/* Chat - Redirects to Chat Page */}
          <button 
            onClick={() => navigate('/app/comunicacao/chat')}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0F172A] border border-white/10 text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5 transition-colors relative"
            title="Ir para o Chat"
          >
            <MessageSquare size={16} />
          </button>
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
