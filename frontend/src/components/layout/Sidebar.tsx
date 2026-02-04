import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  MessageSquare,
  Wallet,
  Settings,
  Sparkles,
  User,
  LogOut,
  ChevronDown,
  X,
  LayoutDashboard,
  Factory,
  GraduationCap,
  Car,
  Box
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
  requires?: { modulo: string; acao: string };
  subItems?: NavSubItem[];
}

interface NavSubItem {
  label: string;
  submodulo: string;
  path?: string;
  requires?: { modulo: string; acao: string };
  subItems?: { label: string; path: string; submodulo: string }[];
}

const navItems: NavItem[] = [
  {
    label: 'DASHBOARD',
    icon: LayoutDashboard,
    modulo: 'dashboard',
    requires: { modulo: 'DASHBOARD', acao: 'VIEW' },
    subItems: [
      { label: 'Comercial', path: '/app/dashboard/comercial', submodulo: 'comercial' },
    ],
  },
  {
    label: 'COMUNIDADE',
    icon: Sparkles,
    modulo: 'comunidade',
    subItems: [
      { label: 'Chat', path: '/app/comunidade/chat', submodulo: 'chat' },
      { label: 'InstaFlow', path: '/app/comunidade', submodulo: 'instaflow' },
      { label: 'Tarefas', path: '/app/comunidade/taskflow', submodulo: 'taskflow' },
      { label: 'Calendário', path: '/app/comunidade/calendario', submodulo: 'calendario' },
    ],
  },
  {
    label: 'UNIVERSIDADE',
    icon: GraduationCap,
    modulo: 'universidade',
    requires: { modulo: 'UNIVERSIDADE', acao: 'VIEW' },
    subItems: [
      { label: 'Catálogos', path: '/app/universidade/catalogos', submodulo: 'catalogos' },
      { label: 'Manuais', path: '/app/universidade/manuais', submodulo: 'manuais' },
      { label: 'Treinamentos', path: '/app/universidade/treinamentos', submodulo: 'treinamentos' },
      { label: 'Instruções de Trabalho', path: '/app/universidade/instrucoes-de-trabalho', submodulo: 'instrucoes-de-trabalho' },
    ],
  },
  {
    label: 'CRM',
    icon: Briefcase,
    modulo: 'crm',
    requires: { modulo: 'CRM', acao: 'VIEW' },
    subItems: [
      { label: 'Proposta Comercial', path: '/app/crm/propostas-comerciais-kanban', submodulo: 'oportunidades-kanban' },
      { label: 'Ranking', path: '/app/crm/ranking', submodulo: 'ranking' },
      { label: 'Clientes', path: '/app/crm/clientes', submodulo: 'clientes' },
    ],
  },
  {
    label: 'PRODUÇÃO',
    icon: Factory,
    modulo: 'producao',
    requires: { modulo: 'PRODUCAO', acao: 'VIEW' },
    subItems: [
      { label: 'Kanban Produção', path: '/app/producao/ordens-servico', submodulo: 'servicos' },
      { label: 'Equipamentos', path: '/app/producao/equipamentos', submodulo: 'equipamentos' },
      { label: 'Certificado garantia', path: '/app/producao/certificado-garantia', submodulo: 'certificado-garantia' },
    ],
  },
  {
    label: 'FROTA',
    icon: Car,
    modulo: 'frota',
    requires: { modulo: 'FROTA', acao: 'VIEW' },
    subItems: [
      { label: 'Veículos', path: '/app/frota/veiculos', submodulo: 'veiculos' },
      { label: 'Diário de Bordo', path: '/app/frota/diario-de-bordo', submodulo: 'diario-de-bordo' },
    ],
  },
  {
    label: 'COMPRAS E ESTOQUE',
    icon: Box,
    modulo: 'compras-estoque',
    requires: { modulo: 'COMPRAS_E_ESTOQUE', acao: 'VIEW' },
    subItems: [
      { label: 'Consultar Estoque', path: '/app/compras-estoque/consultar-estoque', submodulo: 'consultar-estoque' },
      { label: 'Compras', path: '/app/compras-estoque/compras', submodulo: 'compras' },
      { label: 'Cadastrar Serviço', path: '/app/compras-estoque/servicos', submodulo: 'servicos', requires: { modulo: 'COMPRAS_E_ESTOQUE', acao: 'EDIT' } },
      { label: 'Cadastrar Produto', path: '/app/compras-estoque/produtos', submodulo: 'produtos', requires: { modulo: 'COMPRAS_E_ESTOQUE', acao: 'EDIT' } },
      { label: 'Cadastrar NCM', path: '/app/compras-estoque/ncm', submodulo: 'ncm', requires: { modulo: 'COMPRAS_E_ESTOQUE', acao: 'EDIT' } },
    ],
  },
  {
    label: 'SMARTFLOW',
    icon: MessageSquare,
    modulo: 'smartflow',
    requires: { modulo: 'SMARTFLOW', acao: 'VIEW' },
    subItems: [
      { label: 'Atendimentos', path: '/app/smartflow/atendimentos', submodulo: 'atendimentos' },
      { label: 'Kanban de Fluxos', path: '/app/smartflow/kanban-fluxos', submodulo: 'kanban-fluxos' },
    ],
  },
  {
    label: 'FINANCEIRO',
    icon: Wallet,
    modulo: 'financeiro',
    requires: { modulo: 'FINANCEIRO', acao: 'VIEW' },
    subItems: [
      { label: 'Clientes', path: '/app/financeiro/clientes', submodulo: 'clientes', requires: { modulo: 'CRM', acao: 'VIEW' } },
      { label: 'Conta a Receber', path: '/app/financeiro/contas-receber', submodulo: 'contas-receber', requires: { modulo: 'FINANCEIRO', acao: 'VIEW' } },
      { label: 'Conta a Pagar', path: '/app/financeiro/contas-pagar', submodulo: 'contas-pagar', requires: { modulo: 'FINANCEIRO', acao: 'VIEW' } },
      { label: 'Cadastrar IBGE', path: '/app/financeiro/ibge', submodulo: 'ibge', requires: { modulo: 'FINANCEIRO', acao: 'CONTROL' } },
      { label: 'Cadastrar CNAE', path: '/app/financeiro/cnae', submodulo: 'cnae', requires: { modulo: 'FINANCEIRO', acao: 'CONTROL' } },
      { label: 'Cadastrar Forma de Pagamento', path: '/app/financeiro/formas-pagamento', submodulo: 'formas-pagamento', requires: { modulo: 'FINANCEIRO', acao: 'CONTROL' } },
      { label: 'Cadastrar Condição de Pagamento', path: '/app/financeiro/condicoes-pagamento', submodulo: 'condicoes-pagamento', requires: { modulo: 'FINANCEIRO', acao: 'CONTROL' } },
    ],
  },
  {
    label: 'CONFIG GERAIS',
    icon: Settings,
    modulo: 'config-gerais',
    requires: { modulo: 'CONFIGURACOES', acao: 'VIEW' },
    subItems: [
      { label: 'Usuários', path: '/app/configuracoes/usuarios', submodulo: 'usuarios', requires: { modulo: 'CONFIGURACOES', acao: 'CONTROL' } },
      { label: 'Permissões', path: '/app/configuracoes/permissoes', submodulo: 'permissoes', requires: { modulo: 'CONFIGURACOES', acao: 'CONTROL' } },
      { label: 'Transportadora', path: '/app/config-gerais/transportadora', submodulo: 'transportadora' },
      { label: 'Motivos', path: '/app/crm/configs/motivos', submodulo: 'motivos', requires: { modulo: 'CRM', acao: 'CONTROL' } },
      { label: 'Verticais', path: '/app/crm/configs/verticais', submodulo: 'verticais', requires: { modulo: 'CRM', acao: 'CONTROL' } },
      { label: 'Origem de Leads', path: '/app/crm/configs/origem-leads', submodulo: 'origem-leads', requires: { modulo: 'CRM', acao: 'CONTROL' } },
      { label: 'Fase CRM', path: '/app/crm/configs/fases', submodulo: 'fases', requires: { modulo: 'CRM', acao: 'CONTROL' } },
      { label: 'Status CRM', path: '/app/crm/configs/status', submodulo: 'status', requires: { modulo: 'CRM', acao: 'CONTROL' } },
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
  const { signOut, permissions, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasAnyChatUnread } = useNotifications();

  const canSee = useMemo(() => {
    if (!permissions) return (_modulo: string, _acao: string) => false
    return (modulo: string, acao: string) => can(modulo, acao)
  }, [can, permissions])

  const visibleNavItems = useMemo(() => {
    return navItems
      .filter((item) => {
        if (!item.requires) return true
        return canSee(item.requires.modulo, item.requires.acao)
      })
      .map((item) => {
        if (!item.subItems?.length) return item
        const subItems = item.subItems.filter((sub) => {
          if (!sub.requires) return true
          return canSee(sub.requires.modulo, sub.requires.acao)
        })
        return { ...item, subItems }
      })
      .filter((item) => (item.subItems?.length ?? 0) > 0)
  }, [canSee])

  const hasActivePath = (item: NavItem, pathname: string) => {
    return (
      item.subItems?.some((si) => {
        if (si.path && si.path === pathname) return true
        return si.subItems?.some((nested) => nested.path === pathname) ?? false
      }) ?? false
    )
  }

  const [expandedMenu, setExpandedMenu] = useState<string | null>(() => {
    const active = visibleNavItems.find((item) =>
      hasActivePath(item, location.pathname)
    );
    return active?.label ?? null;
  });
  const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>({});
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const showText = !isCollapsed || isMobileMenuOpen;

  const activeMenuLabel = useMemo(() => {
    const active = visibleNavItems.find((item) =>
      hasActivePath(item, location.pathname)
    );
    return active?.label ?? null;
  }, [location.pathname, visibleNavItems]);

  useEffect(() => {
    if (!showText) {
      setExpandedMenu(null);
      return;
    }
    setExpandedMenu(activeMenuLabel);
  }, [activeMenuLabel, showText]);

  useEffect(() => {
    if (!showText) return
    const menu = visibleNavItems.find((it) => it.label === activeMenuLabel)
    if (!menu?.subItems) return

    const activeGroup = menu.subItems.find((si) =>
      si.subItems?.some((nested) => nested.path === location.pathname)
    )
    if (!activeGroup) return

    const key = `${menu.label}:${activeGroup.submodulo}`
    setExpandedSubmenus((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }, [activeMenuLabel, location.pathname, showText]);

  const toggleMenu = (label: string) => {
    if (isCollapsed && setIsExpanded) {
      setIsExpanded(true);
      setExpandedMenu(label);
      return;
    }
    setExpandedMenu((prev) => (prev === label ? null : label));
  };

  const toggleSubmenu = (key: string) => {
    setExpandedSubmenus((prev) => ({ ...prev, [key]: !prev[key] }))
  }

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
        
        {visibleNavItems.map((item) => {
          const isExpanded = expandedMenu === item.label;
          const hasActiveChild = hasActivePath(item, location.pathname);
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
                    {item.modulo === 'comunidade' && hasAnyChatUnread && (
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
                    const hasNested = !!sub.subItems?.length
                    const nestedActive = hasNested
                      ? sub.subItems?.some((nested) => nested.path === location.pathname) ?? false
                      : false

                    if (!hasNested && sub.path) {
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
                            {sub.path === '/app/comunidade/chat' && hasAnyChatUnread && (
                              <span className="w-2 h-2 bg-cyan-500 rounded-full" />
                            )}
                          </div>
                        </Link>
                      );
                    }

                    const key = `${item.label}:${sub.submodulo}`
                    const isSubExpanded = !!expandedSubmenus[key]

                    return (
                      <div key={key} className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSubmenu(key)}
                          className={`w-full px-3 py-2 rounded-md text-[13px] font-medium transition-colors flex items-center justify-between
                            ${nestedActive
                              ? 'text-cyan-400 bg-cyan-500/10'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                            }`}
                        >
                          <span>{sub.label}</span>
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 opacity-60 ${isSubExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isSubExpanded && (
                          <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5">
                            {sub.subItems?.map((nested) => {
                              const active = location.pathname === nested.path
                              return (
                                <Link
                                  key={nested.path}
                                  to={nested.path}
                                  className={`block px-3 py-2 rounded-md text-[13px] font-medium transition-colors
                                    ${active
                                      ? 'text-cyan-400 bg-cyan-500/10'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                  <span>{nested.label}</span>
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
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
             onClick={() => navigate('/app/configuracoes/perfil')}
             className={`group relative flex items-center justify-center rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all duration-200
               ${showText ? 'flex-1 h-8 gap-2' : 'w-10 h-10 hover:scale-105 active:scale-95'}`}
           >
             <User size={showText ? 14 : 18} />
             {showText && <span className="text-[11px] font-medium">Perfil</span>}
             
             {/* Tooltip */}
             {!showText && (
               <div className="hidden group-hover:block absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-md shadow-xl border border-white/10 whitespace-nowrap z-50">
                 Perfil
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
