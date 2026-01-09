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
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
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

  const [expandedMenus, setExpandedMenus] = useState<string[]>([
    'COMERCIAL',
    'COMUNICAÇÃO',
  ]);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const toggleMenu = (label: string) => {
    // If collapsed, expand the sidebar first
    if (isCollapsed && setIsExpanded) {
      setIsExpanded(true);
      // Ensure the menu is open when expanding
      if (!expandedMenus.includes(label)) {
        setExpandedMenus((prev) => [...prev, label]);
      }
      return;
    }

    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const openProfilePage = () => navigate('/app/configuracoes/perfil');
  const handleLogoutClick = () => setIsLogoutModalOpen(true);

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  const showText = !isCollapsed || isMobileMenuOpen;

  // Profile Avatar Logic
  const profileName = profile?.nome?.trim();
  const profileEmail = profile?.email_login || '';
  const profileInitial = (profileName || profileEmail || 'U').substring(0, 1).toUpperCase();
  const avatarUrl = profile?.avatar_url;

  return (
    <>
      {/* BRAND / HEADER */}
      <div className={`h-16 flex items-center shrink-0 border-b border-white/5 transition-all duration-300
        ${showText ? 'px-6 justify-start' : 'px-0 justify-center'}`}>
        
        {/* Logo Image */}
        <img
          src="https://apliflow.com.br/wp-content/uploads/2024/06/af-prata-e-azul-1-1.png"
          alt="ApliFlow"
          className={`transition-all duration-300 object-contain
            ${showText ? 'h-8 opacity-100' : 'h-6 opacity-90 grayscale hover:grayscale-0'}`}
          draggable={false}
        />

        {/* Mobile Close Button */}
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
      <nav className={`flex-1 py-4 overflow-y-auto custom-scrollbar space-y-2
        ${showText ? 'px-3' : 'px-2'}`}>
        {navItems.map((item) => {
          const isExpanded = expandedMenus.includes(item.label);
          const isActive =
            item.path === location.pathname ||
            item.subItems?.some((si) => si.path === location.pathname);

          const menuId = `menu-${item.label.replace(/\s+/g, '-').toLowerCase()}`;

          return (
            <div key={item.label} className="group relative">
              <button
                onClick={() => toggleMenu(item.label)}
                aria-expanded={isExpanded}
                aria-controls={menuId}
                className={`w-full flex items-center transition-all duration-200 rounded-xl
                  ${showText 
                    ? 'justify-between px-3 py-3 gap-3' 
                    : 'justify-center p-3 aspect-square'
                  }
                  ${isActive
                    ? 'text-[#38BDF8] bg-[#38BDF8]/10 shadow-[0_0_15px_rgba(56,189,248,0.1)]'
                    : 'text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5'
                  }`}
              >
                <div className={`flex items-center ${showText ? 'gap-3' : 'gap-0'}`}>
                  <item.icon 
                    size={showText ? 20 : 22} 
                    strokeWidth={1.5} 
                    className={`transition-transform duration-300 ${isActive && !showText ? 'scale-110' : ''}`}
                  />
                  
                  {showText && (
                    <span className="text-[13px] font-semibold tracking-wide">
                      {item.label}
                    </span>
                  )}
                </div>

                {showText && (
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-300 ${
                      isExpanded ? 'rotate-180' : ''
                    } opacity-50`}
                  />
                )}
              </button>

              {/* Tooltip for Collapsed State */}
              {!showText && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 
                                bg-[#1E293B] text-white text-xs font-medium rounded-md shadow-xl 
                                opacity-0 group-hover:opacity-100 pointer-events-none 
                                transition-opacity duration-200 whitespace-nowrap z-50
                                border border-white/10 translate-x-2 group-hover:translate-x-0">
                  {item.label}
                  {/* Triangle arrow */}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-[#1E293B]" />
                </div>
              )}

              {/* Submenu */}
              {showText && isExpanded && (
                <div
                  id={menuId}
                  className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200"
                >
                  {item.subItems?.map((sub) => {
                    const active = location.pathname === sub.path;

                    return (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        aria-current={active ? 'page' : undefined}
                        className={`block px-3 py-2 rounded-lg text-[12px] font-medium transition-colors
                          ${active
                            ? 'text-[#38BDF8] bg-[#38BDF8]/5'
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
      <div className={`shrink-0 border-t border-white/5 transition-all duration-300 flex flex-col
         ${showText ? 'p-4 gap-3' : 'p-3 gap-4 items-center'}`}>
        
        {/* User Info Button */}
        <button
          onClick={openProfilePage}
          className={`flex items-center rounded-xl transition-colors hover:bg-white/5
            ${showText ? 'w-full gap-3 px-3 py-2' : 'w-10 h-10 justify-center p-0'}`}
          title="Perfil"
        >
          {/* Avatar */}
          <div className={`relative rounded-full bg-[#0F172A] border border-white/10 flex items-center justify-center overflow-hidden shrink-0
            ${showText ? 'w-9 h-9' : 'w-full h-full'}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[12px] font-semibold text-[#E5E7EB]">{profileInitial}</span>
            )}
          </div>

          {/* Text Info */}
          {showText && (
            <div className="min-w-0 text-left flex-1">
              <p className="text-[13px] font-semibold truncate text-[#E5E7EB]">
                {profileName || profileEmail.split('@')[0]}
              </p>
              <p className="text-[11px] truncate text-[#9CA3AF]">
                {profileEmail}
              </p>
            </div>
          )}
        </button>

        {/* Action Buttons */}
        <div className={`w-full transition-all duration-300 ${showText ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-4 items-center'}`}>
          <button
            onClick={() => navigate('/app/configuracoes/usuarios')}
            className={`flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 transition-colors border border-transparent hover:border-[#38BDF8]/20
              ${showText ? 'p-2' : 'p-2 w-10 h-10'}`}
            title="Configurações"
          >
            <Settings size={showText ? 18 : 20} strokeWidth={1.5} />
          </button>

          <button
            onClick={handleLogoutClick}
            className={`flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20
              ${showText ? 'p-2' : 'p-2 w-10 h-10'}`}
            title="Sair"
          >
            <LogOut size={showText ? 18 : 20} strokeWidth={1.5} />
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
