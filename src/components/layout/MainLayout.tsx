import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Profile, ProfilePermissao } from '../../../types';
import { useScrollLock } from '../../../hooks/useScrollLock';

interface LayoutProps {
  profile: Profile | null;
  perms: ProfilePermissao[];
  errorMessage?: string;
  children?: React.ReactNode;
}

const MainLayout: React.FC<LayoutProps> = ({ profile, errorMessage, children }) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const location = useLocation();

  // Safe default profile (visual only – não altera lógica)
  const safeProfile: Profile = profile || {
    id: '',
    nome: '',
    email_login: '',
    ativo: true,
    avatar_url: '',
    created_at: new Date().toISOString(),
    cargo: null,
  };

  const profileView = useMemo(() => safeProfile, [safeProfile]);

  // Collapse sidebar automatically on route change if expanded (mobile behavior or overlay)
  useEffect(() => {
    setIsMobileMenuOpen(false);
    // Optional: Collapse desktop overlay on navigation?
    // User requirement: "Ao clicar fora: → Sidebar volta a recolher".
    // Usually navigation implies clicking a link, which might be "inside" or might close it.
    // Let's keep it expanded if user is navigating deep, or close it?
    // "Linear, Vercel" usually close on selection.
    // Let's close it on route change.
    setIsSidebarExpanded(false);
  }, [location.pathname]);

  // Online / Offline indicator
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

  // Lock scroll when mobile menu is open
  useScrollLock(isMobileMenuOpen);

  // ESC closes mobile menu or expanded sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsSidebarExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-[#E5E7EB] font-sans selection:bg-[#38BDF8]/30">
      {/* BACKDROP FOR DESKTOP EXPANSION */}
      <div 
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 hidden lg:block
          ${isSidebarExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarExpanded(false)}
        aria-hidden="true"
      />

      {/* DESKTOP SIDEBAR (DOCK + OVERLAY) */}
      <aside
        className={`fixed left-0 top-0 h-full hidden lg:flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
          ${isSidebarExpanded ? 'w-64 shadow-2xl shadow-black/50' : 'w-20'}
          bg-[#0F172A] border-r border-white/5`}
        role="navigation"
        aria-label="Navegação principal"
      >
        <Sidebar
          isCollapsed={!isSidebarExpanded}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          setIsExpanded={setIsSidebarExpanded}
          profile={profileView}
        />
      </aside>

      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <aside
            className="w-64 h-full bg-[#0F172A] border-r border-white/5 flex flex-col
                       transition-transform duration-300 ease-in-out translate-x-0 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              isCollapsed={false}
              isMobileMenuOpen={true}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              profile={profileView}
            />
          </aside>
        </div>
      )}

      {/* MAIN CONTENT */}
      {/* Added ml-20 to push content to the right of the dock */}
      <div className="flex-1 flex flex-col overflow-hidden relative lg:ml-20 transition-all duration-300">
        <Header
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isCollapsed={!isSidebarExpanded}
          setIsCollapsed={(collapsed) => setIsSidebarExpanded(!collapsed)}
          profile={profileView}
          supabaseConnected={supabaseConnected}
          errorMessage={errorMessage}
        />

        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 custom-scrollbar">
          <div
            className="min-h-full rounded-2xl bg-[#111827] border border-white/5
                       p-4 sm:p-6 shadow-sm"
          >
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
