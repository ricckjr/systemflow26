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
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1280);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const location = useLocation();

  // Safe default profile (visual only – não altera lógica)
  const safeProfile: Profile = profile || {
    id: '',
    nome: '',
    email_login: '',
    role: 'user',
    status: 'online',
    ativo: true,
    created_at: new Date().toISOString(),
  };

  const profileView = useMemo(() => safeProfile, [safeProfile]);

  // Collapse sidebar automatically on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
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

  // ESC closes mobile menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-[#E5E7EB] font-sans selection:bg-[#38BDF8]/30">
      {/* DESKTOP SIDEBAR */}
      <aside
        className={`relative hidden lg:flex flex-col z-30 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          bg-[#0F172A] border-r border-white/5`}
        role="navigation"
        aria-label="Navegação principal"
      >
        <Sidebar
          isCollapsed={isCollapsed}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
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
                       transition-transform duration-300 ease-in-out translate-x-0"
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
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
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
