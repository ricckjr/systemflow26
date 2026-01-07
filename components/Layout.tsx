import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Briefcase, 
  MessageSquare, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  LogOut,
  Megaphone,
  ChevronDown,
  Database,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { Profile, ProfilePermissao } from '../types';
import { supabase } from '../supabaseClient';
import { useTheme } from '../hooks/useTheme';
import { useScrollLock } from '../hooks/useScrollLock';

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
    ]
  },
  { 
    label: 'Comercial', 
    icon: Briefcase,
    modulo: 'comercial',
    subItems: [
      { label: 'Visão Comercial', path: '/app/comercial/overview', submodulo: 'overview' },
      { label: 'Vendedores', path: '/app/comercial/vendedores', submodulo: 'vendedores' },
      { label: 'Oportunidades', path: '/app/comercial/oportunidades', submodulo: 'oportunidades' },
    ] 
  },
  { 
    label: 'Comunicação', 
    icon: MessageSquare,
    modulo: 'comunicacao',
    subItems: [
      { label: 'Chat Interno', path: '/app/comunicacao/chat', submodulo: 'chat' },
      { label: 'FlowSmart', path: '/app/comunicacao/flowsmart', submodulo: 'flowsmart' },
      { label: 'Assistente Flow', path: '/app/comunicacao/ia', submodulo: 'ia-flow' },
    ] 
  },
];

interface LayoutProps {
  profile: Profile | null;
  perms: ProfilePermissao[];
  errorMessage?: string;
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ profile, errorMessage, children }) => {
  const { theme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1280);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Comercial', 'Comunicação']);
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  // Safe default profile if null
  const safeProfile = profile || {
      id: '',
      nome: 'Carregando...',
      email_login: '',
      role: 'user',
      status: 'online',
      ativo: true,
      created_at: new Date().toISOString()
  };
  const profileView = useMemo<Profile>(() => safeProfile, [safeProfile]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false); 
  }, [location.pathname]);

  useEffect(() => {
    const update = () => setSupabaseConnected(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // profileView derivado via useMemo

  useScrollLock(isMobileMenuOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openProfilePage = () => navigate('/app/configuracoes/perfil');

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const handleLogout = async () => {
    const ok = window.confirm('Deseja sair do sistema?')
    if (!ok) return
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-')) localStorage.removeItem(k);
      });
    } catch {}
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  };

  const SidebarContent = () => (
    <>
      <div className="h-20 flex items-center px-6 border-b border-line overflow-hidden shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-brand-600/20 border border-brand-600/30 rounded-lg flex items-center justify-center text-white shrink-0">
             <div className="w-5 h-5 bg-current rounded-md transform rotate-45 shrink-0"></div>
          </div>
          {(!isCollapsed || isMobileMenuOpen) && (
            <img
              src="https://apliflow.com.br/wp-content/uploads/2024/06/af-prata-e-azul-1-1.png"
              alt="ApliFlow"
              className="h-6"
              draggable={false}
            />
          )}
        </div>
        {isMobileMenuOpen && (
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto text-ink-800 hover:text-white">
            <X size={24} />
          </button>
        )}
      </div>

      <div className="flex-1 px-3 py-6 overflow-y-auto custom-scrollbar space-y-1.5">
        {navItems.map((item) => {
          const isExpanded = expandedMenus.includes(item.label);
          const isActive = item.path === location.pathname || item.subItems?.some(si => si.path === location.pathname);
          const showText = !isCollapsed || isMobileMenuOpen;
          const menuId = `menu-${item.label.replace(/\s+/g, '-').toLowerCase()}`;

          return (
            <div key={item.label} className="group">
              {item.path ? (
                <Link
                  to={item.path}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                  className={`sidebar-item ${location.pathname === item.path ? 'active' : ''} flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 hover:bg-white/7`}
                >
                  <item.icon size={18} className="shrink-0" strokeWidth={2} />
                  {showText && <span className="text-[13px] font-bold tracking-tight">{item.label}</span>}
                </Link>
              ) : (
                <div>
                  <button
                    onClick={() => showText && toggleMenu(item.label)}
                    className={`sidebar-item ${isActive ? 'active' : ''} w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 hover:bg-white/7`}
                    aria-expanded={isExpanded}
                    aria-controls={menuId}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className="shrink-0" strokeWidth={2} />
                      {showText && <span className="text-[13px] font-bold tracking-tight">{item.label}</span>}
                    </div>
                    {showText && <ChevronDown size={14} className={`transition-transform duration-150 opacity-50 ${isExpanded ? 'rotate-180' : ''}`} />}
                  </button>
                  {showText && isExpanded && (
                    <div id={menuId} className="mt-1 ml-3 pl-3 border-l border-line space-y-1.5">
                      {item.subItems?.map((sub) => (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          aria-current={location.pathname === sub.path ? 'page' : undefined}
                          className={`sidebar-item ${location.pathname === sub.path ? 'active' : ''} block text-[10px] py-2 px-3 rounded-md transition duration-200 ease-in-out font-bold tracking-wider uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 hover:bg-white/7 hover:translate-x-[2px]`}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-5 border-t border-white/10 space-y-3 shrink-0">
        <button
          onClick={openProfilePage}
          className="group w-full flex items-center justify-between px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
          title="Abrir perfil"
          aria-label="Abrir perfil do usuário"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full border border-brand-600/30 shrink-0">
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-white font-bold text-xs border border-line">
                {(profileView.nome || 'U').substring(0, 1).toUpperCase()}
              </div>
            </div>
            {(!isCollapsed || isMobileMenuOpen) && (
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-white leading-tight truncate">{profileView.nome || 'Usuário'}</p>
                <p className="text-[10px] text-blue-400 mt-0.5 uppercase font-bold tracking-widest">{profileView.role || 'user'}</p>
                <p className="text-[10px] text-ink-800 truncate">{profileView.email_login || ''}</p>
              </div>
            )}
          </div>
          <ChevronRight size={16} className="text-white/50 group-hover:text-white/80 shrink-0" />
        </button>
        <button
          onClick={() => navigate('/app/configuracoes/usuarios')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-line bg-white/5 hover:bg-white/8 transition-colors focus-outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          title="Configurações"
          aria-label="Abrir configurações"
        >
          <Settings size={18} className="text-white/80" />
          {(!isCollapsed || isMobileMenuOpen) && <span className="text-sm font-bold">Usuários</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-line bg-white/5 hover:bg-white/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          title="Sair do Sistema"
          aria-label="Sair do sistema"
        >
          <LogOut size={18} className="text-white/80" />
          {(!isCollapsed || isMobileMenuOpen) && <span className="text-sm font-bold">Sair do Sistema</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen overflow-y-auto bg-background text-white font-sans selection:bg-blue-500/30">

      <aside
        className={`relative hidden lg:flex transition-all duration-300 ease-in-out flex-col z-30 ${isCollapsed ? 'w-20' : 'w-64'} bg-surface border-r border-line`}
        role="navigation"
        aria-label="Navegação principal"
      >
        <SidebarContent />
      </aside>

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-background/90 animate-fade-in" onClick={() => setIsMobileMenuOpen(false)}>
          <aside
            className="w-64 h-full bg-surface border-r border-line flex flex-col transition-transform duration-300 ease-in-out translate-x-0"
            style={{ willChange: 'transform' }}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header className="h-16 px-6 flex items-center justify-between z-20 shrink-0 border-b border-line bg-surface">
          <div className="flex items-center gap-4">
        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg text-white/70 hover:bg-white/10 transition-all">
              <Menu size={24} />
            </button>
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex p-2 rounded-lg text-white/60 hover:text-blue-400 hover:bg-white/10 transition-all">
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
            
            <h1 className="text-[15px] font-extrabold text-white tracking-tight ml-1">
              {(() => {
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
                }
                return map[location.pathname] || (location.pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').toUpperCase() || 'DASHBOARD')
              })()}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {errorMessage && (
              <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold">
                {errorMessage}
              </div>
            )}
            <div className="flex items-center gap-2" title={supabaseConnected ? "Sistema Online" : "Offline"}>
              <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/7 border border-white/10">
                <div className={`w-2 h-2 rounded-full ${supabaseConnected ? "bg-emerald-400" : "bg-amber-400"}`}></div>
                <span className="text-[10px] font-bold text-white/80 tracking-wider uppercase">Status</span>
              </div>
            </div>

            <div className="flex items-center gap-4 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white leading-none">{profile?.nome || 'Usuário'}</p>
                <p className="text-[10px] text-blue-400 mt-1 uppercase font-bold tracking-widest">{profile?.role || 'Visitante'}</p>
              </div>
              <div className="w-9 h-9 rounded-full border border-brand-600/30">
                <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-white font-bold text-xs border border-line">
                  {(profile?.nome || 'U').substring(0, 2).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
          <div className="min-h-[calc(100vh-6rem)] bg-card border border-line rounded-[24px] animate-in fade-in zoom-in-95 duration-300 p-4">
            {children || <Outlet />}
          </div>
        </main>
      </div>
      {/* modal removido; perfil agora é uma página dedicada */}
    </div>
  );
};

export default Layout;
