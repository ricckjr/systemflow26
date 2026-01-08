import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, ChevronRight, ChevronLeft } from 'lucide-react';
import { Profile } from '../../../types';

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
      <div className="flex items-center gap-5">
        {/* Error message */}
        {errorMessage && (
          <div className="px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium">
            {errorMessage}
          </div>
        )}

        {/* Connection status */}
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-[#0F172A]"
          title={supabaseConnected ? 'Sistema Online' : 'Sistema Offline'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              supabaseConnected
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                : 'bg-amber-500'
            }`}
          />
          <span className="text-[10px] font-semibold tracking-widest uppercase text-[#9CA3AF]">
            {supabaseConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
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
              {profile?.role || 'Visitante'}
            </p>
          </div>

          <div className="w-8 h-8 rounded-full border border-white/10 bg-[#0F172A] flex items-center justify-center text-[11px] font-semibold text-[#E5E7EB]">
            {(() => {
              const name = profile?.nome?.trim();
              const base = name || ((profile as any)?.email_login || '');
              const initial = typeof base === 'string' && base.length > 0 ? base.substring(0, 2) : 'U';
              return initial.toUpperCase();
            })()}
          </div>
        </div>
      </div>
    </header>
  );
};
