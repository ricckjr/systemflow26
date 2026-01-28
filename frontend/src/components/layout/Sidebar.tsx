import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  MessageSquare,
  Settings,
  LogOut,
  Megaphone,
  ChevronDown,
  X,
  LayoutDashboard,
  Users,
  Factory,
  GraduationCap,
  Car
} from 'lucide-react';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { LogoutModal } from '../ui/LogoutModal';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  modulo?: string;
  subItems?: { label: string; path: string; submodulo: string }[];
}

const navItems: NavItem[] = [
  {
    label: 'COMUNIDADE',
    icon: Users,
    modulo: 'comunidade',
    subItems: [
      { label: 'InstaFlow', path: '/app/comunidade', submodulo: 'instaflow' },
      { label: 'TaskFlow', path: '/app/comunidade/taskflow', submodulo: 'taskflow' },
    ],
  },
  {
    label: 'COMERCIAL',
    icon: Briefcase,
    modulo: 'comercial',
    subItems: [
      { label: 'Visão Geral', path: '/app/comercial/overview', submodulo: 'overview' },
      { label: 'Vendedores', path: '/app/comercial/vendedores', submodulo: 'vendedores' },
      { label: 'Oportunidades', path: '/app/comercial/oportunidades', submodulo: 'oportunidades' },
    ],
  },
  {
    label: 'COMUNICAÇÃO',
    icon: MessageSquare,
    modulo: 'comunicacao',
    subItems: [
      { label: 'Chat', path: '/app/comunicacao/chat', submodulo: 'chat' },
      { label: 'FlowSmart', path: '/app/comunicacao/flowsmart', submodulo: 'flowsmart' },
      { label: 'Assistente Flow', path: '/app/comunicacao/ia', submodulo: 'ia-flow' },
    ],
  },
  {
    label: 'PRODUÇÃO',
    icon: Factory,
    modulo: 'producao',
    subItems: [
      { label: 'Propostas', path: '/app/producao/propostas', submodulo: 'omie' },
      { label: 'Ordens de Serviço', path: '/app/producao/ordens-servico', submodulo: 'servicos' },
      { label: 'Equipamentos', path: '/app/producao/equipamentos', submodulo: 'equipamentos' },
    ],
  },
  {
    label: 'FROTA',
    icon: Car,
    modulo: 'frota',
    subItems: [
      { label: 'Veículos', path: '/app/frota/veiculos', submodulo: 'veiculos' },
      { label: 'Diário de Bordo', path: '/app/frota/diario-de-bordo', submodulo: 'diario-de-bordo' },
    ],
  },
  {
    label: 'UNIVERSIDADE',
    icon: GraduationCap,
    modulo: 'universidade',
    subItems: [
      { label: 'Catálogos', path: '/app/universidade/catalogos', submodulo: 'catalogos' },
      { label: 'Manuais', path: '/app/universidade/manuais', submodulo: 'manuais' },
      { label: 'Treinamentos', path: '/app/universidade/treinamentos', submodulo: 'treinamentos' },
      { label: 'Instruções de Trabalho', path: '/app/universidade/instrucoes-de-trabalho', submodulo: 'instrucoes-de-trabalho' },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  setIsExpanded?: (expand: boolean) => void;
  profile: Profile;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setIsExpanded,
  profile,
}) => {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasAnyChatUnread } = useNotifications();

  const [expandedMenu, setExpandedMenu] = useState<string | null>(() => {
    const active = navItems.find((item) =>
      item.subItems?.some((si) => si.path === location.pathname)
    );
    return active?.label ?? null;
  });
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const showText = !isCollapsed || isMobileMenuOpen;

  const activeMenuLabel = useMemo(() => {
    const active = navItems.find((item) =>
      item.subItems?.some((si) => si.path === location.pathname)
    );
    return active?.label ?? null;
  }, [location.pathname]);

  useEffect(() => {
    if (!showText) {
      setExpandedMenu(null);
      return;
    }
    setExpandedMenu(activeMenuLabel);
  }, [activeMenuLabel, showText]);

  const toggleMenu = (label: string) => {
    if (isCollapsed && setIsExpanded) {
      setIsExpanded(true);
      setExpandedMenu(label);
      return;
    }
    setExpandedMenu((prev) => (prev === label ? null : label));
  };

  const openProfilePage = () => navigate('/app/configuracoes/perfil');
  const handleLogoutClick = () => setIsLogoutModalOpen(true);

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  const avatarUrl = profile?.avatar_url;
  const profileInitial = (profile?.nome || 'U').substring(0, 1).toUpperCase();

  return (
    <>
      {/* HEADER / LOGO */}
      <div className={`h-16 flex items-center shrink-0 border-b border-white/5 bg-[#0F172A] transition-all duration-300
        ${showText ? 'px-6 justify-start' : 'px-0 justify-center'}`}>
        
        <div className="flex items-center gap-3">
          <img
            src="https://apliflow.com.br/wp-content/uploads/2024/06/af-prata-e-azul-1-1.png"
            alt="SystemFlow"
            className={`transition-all duration-300 object-contain
              ${showText ? 'h-7 opacity-90' : 'h-6 opacity-80'}`}
            draggable={false}
          />
        </div>

        {isMobileMenuOpen && (
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="ml-auto text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* NAVIGATION */}
      <nav className={`flex-1 py-6 overflow-y-auto custom-scrollbar space-y-1 bg-[#0F172A]
        ${showText ? 'px-4' : 'px-2'}`}>
        
        {navItems.map((item) => {
          const isExpanded = expandedMenu === item.label;
          const hasActiveChild = item.subItems?.some((si) => si.path === location.pathname);
          const isActive = hasActiveChild || isExpanded;

          return (
            <div key={item.label} className="mb-2 relative group">
              <button
                onClick={() => toggleMenu(item.label)}
                className={`w-full flex items-center transition-all duration-200 rounded-lg
                  ${showText 
                    ? 'justify-between px-3 py-2.5' 
                    : 'justify-center p-2.5 aspect-square'
                  }
                  ${isActive 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }
                `}
              >
                <div className={`flex items-center ${showText ? 'gap-3' : 'gap-0'}`}>
                  <div className="relative">
                    <item.icon 
                      size={showText ? 18 : 20} 
                      strokeWidth={1.5}
                      className={isActive ? 'text-cyan-500' : 'text-slate-500 group-hover:text-slate-300'}
                    />
                    {item.modulo === 'comunicacao' && hasAnyChatUnread && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full border border-[#0F172A]" />
                    )}
                  </div>
                  {showText && (
                    <span className="text-[11px] font-bold tracking-widest uppercase">
                      {item.label}
                    </span>
                  )}
                </div>

                {showText && (
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 opacity-50 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                )}
              </button>

              {/* Tooltip (Collapsed) */}
              {!showText && (
                <div className="hidden group-hover:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-md shadow-xl border border-white/10 whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}

              {/* Submenu */}
              {showText && isExpanded && (
                <div className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                  {item.subItems?.map((sub) => {
                    const active = location.pathname === sub.path;
                    return (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`block px-3 py-2 rounded-md text-[13px] font-medium transition-colors
                          ${active
                            ? 'text-cyan-400 bg-cyan-500/10'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{sub.label}</span>
                          {sub.path === '/app/comunicacao/chat' && hasAnyChatUnread && (
                            <span className="w-2 h-2 bg-cyan-500 rounded-full" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className={`shrink-0 border-t border-white/5 bg-[#0B1120] transition-all duration-300
         ${showText ? 'p-4' : 'py-6 flex flex-col items-center gap-6'}`}>
        
        <button
          onClick={openProfilePage}
          className={`flex items-center gap-3 group transition-colors w-full rounded-lg relative
            ${showText ? 'hover:bg-white/5 p-2' : 'justify-center'}`}
        >
          <div className={`rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/10 transition-all duration-300
            ${showText ? 'w-8 h-8' : 'w-10 h-10 ring-2 ring-white/5 group-hover:ring-white/20'}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className={`${showText ? 'text-xs' : 'text-sm'} font-bold text-slate-400`}>{profileInitial}</span>
            )}
          </div>
          
          {showText && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-[13px] font-medium text-slate-200 truncate group-hover:text-white">
                {profile?.nome || 'Usuário'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {profile?.cargo || 'Membro'}
              </p>
            </div>
          )}

          {/* Tooltip (Collapsed) */}
          {!showText && (
            <div className="hidden group-hover:block absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-md shadow-xl border border-white/10 whitespace-nowrap z-50">
              {profile?.nome || 'Meu Perfil'}
            </div>
          )}
        </button>

        <div className={`flex items-center ${showText ? 'gap-2 mt-2' : 'flex-col gap-3 w-full'}`}>
           <button
             onClick={() => navigate('/app/configuracoes/usuarios')}
             className={`group relative flex items-center justify-center rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all duration-200
               ${showText ? 'flex-1 h-8 gap-2' : 'w-10 h-10 hover:scale-105 active:scale-95'}`}
           >
             <Settings size={showText ? 14 : 18} />
             {showText && <span className="text-[11px] font-medium">Ajustes</span>}
             
             {/* Tooltip */}
             {!showText && (
               <div className="hidden group-hover:block absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-md shadow-xl border border-white/10 whitespace-nowrap z-50">
                 Configurações
               </div>
             )}
           </button>
           <button
             onClick={handleLogoutClick}
             className={`group relative flex items-center justify-center rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all duration-200
               ${showText ? 'flex-1 h-8 gap-2' : 'w-10 h-10 hover:scale-105 active:scale-95'}`}
           >
             <LogOut size={showText ? 14 : 18} />
             {showText && <span className="text-[11px] font-medium">Sair</span>}

             {/* Tooltip */}
             {!showText && (
               <div className="hidden group-hover:block absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-md shadow-xl border border-white/10 whitespace-nowrap z-50">
                 Sair
               </div>
             )}
           </button>
        </div>
      </div>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
};
