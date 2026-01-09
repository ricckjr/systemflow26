import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  MessageSquare,
  Settings,
  LogOut,
  Megaphone,
  ChevronDown,
  X
} from 'lucide-react';
import { Profile } from '../../../types';
import { useAuth } from '../../contexts/AuthContext';
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
    label: 'COMUNIDADE FLOW',
    icon: Megaphone,
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
      { label: 'Visão Comercial', path: '/app/comercial/overview', submodulo: 'overview' },
      { label: 'Vendedores', path: '/app/comercial/vendedores', submodulo: 'vendedores' },
      { label: 'Oportunidades', path: '/app/comercial/oportunidades', submodulo: 'oportunidades' },
    ],
  },
  {
    label: 'COMUNICAÇÃO',
    icon: MessageSquare,
    modulo: 'comunicacao',
    subItems: [
      { label: 'Chat Interno', path: '/app/comunicacao/chat', submodulo: 'chat' },
      { label: 'FlowSmart', path: '/app/comunicacao/flowsmart', submodulo: 'flowsmart' },
      { label: 'Assistente Flow', path: '/app/comunicacao/ia', submodulo: 'ia-flow' },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  profile: Profile;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  profile,
}) => {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [expandedMenus, setExpandedMenus] = useState<string[]>([
    'COMERCIAL',
    'COMUNICAÇÃO',
  ]);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const toggleMenu = (label: string) => {
    // Se estiver colapsado, expande a sidebar automaticamente
    if (isCollapsed) {
       // Não podemos controlar o estado colapsado diretamente aqui pois é prop, 
       // mas podemos assumir que o usuário quer ver o menu.
       // Idealmente, a sidebar deveria receber uma função para expandir.
       // Como não temos, vamos apenas permitir a expansão do menu interno para quando o usuário expandir a sidebar.
    }
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const openProfilePage = () => navigate('/app/configuracoes/perfil');
  const handleLogoutClick = () => setIsLogoutModalOpen(true);

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false) // Close modal immediately
    await signOut();
    // Navigate is redundant here because signOut forces redirect, but kept for safety
    navigate('/login', { replace: true });
  };

  const showText = !isCollapsed || isMobileMenuOpen;

  return (
    <>
      {/* BRAND / HEADER */}
      <div className="h-16 flex items-center px-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8] shrink-0">
            <div className="w-4 h-4 bg-current rounded-sm rotate-45" />
          </div>

          {showText && (
            <img
              src="https://apliflow.com.br/wp-content/uploads/2024/06/af-prata-e-azul-1-1.png"
              alt="ApliFlow"
              className="h-6 opacity-90 grayscale hover:grayscale-0 transition"
              draggable={false}
            />
          )}
        </div>

        {isMobileMenuOpen && (
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="ml-auto p-2 rounded-md text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5 transition"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* NAV */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar space-y-1">
        {navItems.map((item) => {
          const isExpanded = expandedMenus.includes(item.label);
          const isActive =
            item.path === location.pathname ||
            item.subItems?.some((si) => si.path === location.pathname);

          const menuId = `menu-${item.label.replace(/\s+/g, '-').toLowerCase()}`;

          return (
            <div key={item.label}>
              <button
                onClick={() => showText && toggleMenu(item.label)}
                aria-expanded={isExpanded}
                aria-controls={menuId}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition
                  ${
                    isActive
                      ? 'text-[#38BDF8]'
                      : 'text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} strokeWidth={1.5} />
                  {showText && (
                    <span className="text-[12px] font-semibold tracking-wide">
                      {item.label}
                    </span>
                  )}
                </div>

                {showText && (
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    } opacity-50`}
                  />
                )}
              </button>

              {showText && isExpanded && (
                <div
                  id={menuId}
                  className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-1"
                >
                  {item.subItems?.map((sub) => {
                    const active = location.pathname === sub.path;

                    return (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        aria-current={active ? 'page' : undefined}
                        className={`block px-3 py-2 rounded-md text-[11px] font-medium transition
                          ${
                            active
                              ? 'text-[#38BDF8] bg-[#38BDF8]/10'
                              : 'text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5'
                          }`}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER / PROFILE */}
      <div className="p-4 space-y-3 border-t border-white/5 shrink-0">
        <button
          onClick={openProfilePage}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition"
        >
          <div className="w-8 h-8 rounded-full bg-[#0F172A] border border-white/10 flex items-center justify-center text-[11px] font-semibold">
            {(() => {
              const name = profile?.nome?.trim();
              const base = name || profile?.email_login || '';
              const initial = base.length ? base.substring(0, 1) : 'U';
              return initial.toUpperCase();
            })()}
          </div>

          {showText && (
            <div className="min-w-0 text-left">
              <p className="text-[13px] font-medium truncate text-[#E5E7EB]">
                {(() => {
                  const name = profile?.nome?.trim();
                  if (name) return name;
                  const email = profile?.email_login || '';
                  const local = email ? email.split('@')[0] : '';
                  return local;
                })()}
              </p>
              <p className="text-[10px] truncate text-[#9CA3AF]">
                {profile.email_login || ''}
              </p>
            </div>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('/app/configuracoes/usuarios')}
            className="flex items-center justify-center p-2 rounded-lg text-[#9CA3AF] hover:text-[#38BDF8] hover:bg-white/5 transition"
            title="Configurações"
          >
            <Settings size={18} strokeWidth={1.5} />
          </button>

          <button
            onClick={handleLogoutClick}
            className="flex items-center justify-center p-2 rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition"
            title="Sair"
          >
            <LogOut size={18} strokeWidth={1.5} />
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
