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
  Box,
  AlertTriangle,
} from 'lucide-react';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/useNotifications';
import { LogoutModal } from '../ui/LogoutModal';
import { supabase } from '@/services/supabase';
import { PAGE_BASE_MODULO_BY_PAGE_MODULO } from '@/constants/appPages'

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
    requires: { modulo: 'PAGINA__DASHBOARD__COMERCIAL', acao: 'VIEW' },
    subItems: [
      { label: 'Comercial', path: '/app/dashboard/comercial', submodulo: 'comercial', requires: { modulo: 'PAGINA__DASHBOARD__COMERCIAL', acao: 'VIEW' } },
    ],
  },
  {
    label: 'CRM',
    icon: Briefcase,
    modulo: 'crm',
    requires: { modulo: 'PAGINA__CRM__PROPOSTAS_COMERCIAIS_KANBAN', acao: 'VIEW' },
    subItems: [
      { label: 'Proposta Comercial', path: '/app/crm/propostas-comerciais-kanban', submodulo: 'oportunidades-kanban', requires: { modulo: 'PAGINA__CRM__PROPOSTAS_COMERCIAIS_KANBAN', acao: 'VIEW' } },
      { label: 'Vendedores', path: '/app/crm/ranking', submodulo: 'ranking', requires: { modulo: 'PAGINA__CRM__RANKING', acao: 'VIEW' } },
      { label: 'Clientes', path: '/app/crm/clientes', submodulo: 'clientes', requires: { modulo: 'PAGINA__CRM__CLIENTES', acao: 'VIEW' } },
    ],
  },
  {
    label: 'PRODUÇÃO',
    icon: Factory,
    modulo: 'producao',
    requires: { modulo: 'PAGINA__PRODUCAO__ORDENS_SERVICO', acao: 'VIEW' },
    subItems: [
      { label: 'Logística', path: '/app/producao/logistica', submodulo: 'logistica', requires: { modulo: 'PAGINA__PRODUCAO__LOGISTICA', acao: 'VIEW' } },
      { label: 'Kanban Produção', path: '/app/producao/ordens-servico', submodulo: 'servicos', requires: { modulo: 'PAGINA__PRODUCAO__ORDENS_SERVICO', acao: 'VIEW' } },
      { label: 'Lista Equipamentos', path: '/app/producao/equipamentos', submodulo: 'equipamentos', requires: { modulo: 'PAGINA__PRODUCAO__EQUIPAMENTOS', acao: 'VIEW' } },
      { label: 'Certificado Garantia', path: '/app/producao/certificado-garantia', submodulo: 'certificado-garantia', requires: { modulo: 'PAGINA__PRODUCAO__CERTIFICADO_GARANTIA', acao: 'VIEW' } },
    ],
  },
  {
    label: 'COMPRAS E ESTOQUE',
    icon: Box,
    modulo: 'compras-estoque',
    requires: { modulo: 'PAGINA__COMPRAS_E_ESTOQUE__CONSULTAR_ESTOQUE', acao: 'VIEW' },
    subItems: [
      { label: 'Consultar Estoque', path: '/app/compras-estoque/consultar-estoque', submodulo: 'consultar-estoque', requires: { modulo: 'PAGINA__COMPRAS_E_ESTOQUE__CONSULTAR_ESTOQUE', acao: 'VIEW' } },
      { label: 'Locais do Estoque', path: '/app/compras-estoque/locais-estoque', submodulo: 'locais-estoque', requires: { modulo: 'PAGINA__COMPRAS_E_ESTOQUE__LOCAIS_ESTOQUE', acao: 'VIEW' } },
      { label: 'Compras', path: '/app/compras-estoque/compras', submodulo: 'compras', requires: { modulo: 'PAGINA__COMPRAS_E_ESTOQUE__COMPRAS', acao: 'VIEW' } },
      { label: 'Transportadora', path: '/app/compras-estoque/transportadora', submodulo: 'transportadora', requires: { modulo: 'PAGINA__COMPRAS_E_ESTOQUE__TRANSPORTADORA', acao: 'VIEW' } },
      { label: 'Cadastrar Serviço', path: '/app/compras-estoque/servicos', submodulo: 'servicos', requires: { modulo: 'PAGINA__COMPRAS_E_ESTOQUE__SERVICOS', acao: 'VIEW' } },
      { label: 'Cadastrar NCM', path: '/app/compras-estoque/ncm', submodulo: 'ncm', requires: { modulo: 'PAGINA__COMPRAS_E_ESTOQUE__NCM', acao: 'VIEW' } },
    ],
  },
  {
    label: 'FINANCEIRO',
    icon: Wallet,
    modulo: 'financeiro',
    requires: { modulo: 'PAGINA__FINANCEIRO__CONTAS_RECEBER', acao: 'VIEW' },
    subItems: [
      { label: 'Conta a Receber', path: '/app/financeiro/contas-receber', submodulo: 'contas-receber', requires: { modulo: 'PAGINA__FINANCEIRO__CONTAS_RECEBER', acao: 'VIEW' } },
      { label: 'Conta a Pagar', path: '/app/financeiro/contas-pagar', submodulo: 'contas-pagar', requires: { modulo: 'PAGINA__FINANCEIRO__CONTAS_PAGAR', acao: 'VIEW' } },
      { label: 'Cadastrar IBGE', path: '/app/financeiro/ibge', submodulo: 'ibge', requires: { modulo: 'PAGINA__FINANCEIRO__IBGE', acao: 'VIEW' } },
      { label: 'Cadastrar CNAE', path: '/app/financeiro/cnae', submodulo: 'cnae', requires: { modulo: 'PAGINA__FINANCEIRO__CNAE', acao: 'VIEW' } },
      { label: 'Cadastrar Forma de Pagamento', path: '/app/financeiro/formas-pagamento', submodulo: 'formas-pagamento', requires: { modulo: 'PAGINA__FINANCEIRO__FORMAS_PAGAMENTO', acao: 'VIEW' } },
      { label: 'Cadastrar Condição de Pagamento', path: '/app/financeiro/condicoes-pagamento', submodulo: 'condicoes-pagamento', requires: { modulo: 'PAGINA__FINANCEIRO__CONDICOES_PAGAMENTO', acao: 'VIEW' } },
    ],
  },
  {
    label: 'ADMINISTRATIVO',
    icon: User,
    modulo: 'administrativo',
    subItems: [
      { label: 'Empresa Correspondente', path: '/app/financeiro/empresas-correspondentes', submodulo: 'empresas-correspondentes', requires: { modulo: 'PAGINA__FINANCEIRO__EMPRESAS_CORRESPONDENTES', acao: 'VIEW' } },
      { label: 'Colaboradores', path: '/app/administrativo/colaboradores', submodulo: 'colaboradores', requires: { modulo: 'PAGINA__ADMINISTRATIVO__COLABORADORES', acao: 'VIEW' } },
    ],
  },
  {
    label: 'FROTA',
    icon: Car,
    modulo: 'frota',
    requires: { modulo: 'PAGINA__FROTA__VEICULOS', acao: 'VIEW' },
    subItems: [
      { label: 'Veículos', path: '/app/frota/veiculos', submodulo: 'veiculos', requires: { modulo: 'PAGINA__FROTA__VEICULOS', acao: 'VIEW' } },
      { label: 'Diário de Bordo', path: '/app/frota/diario-de-bordo', submodulo: 'diario-de-bordo', requires: { modulo: 'PAGINA__FROTA__DIARIO_BORDO', acao: 'VIEW' } },
    ],
  },
  {
    label: 'SMARTFLOW',
    icon: MessageSquare,
    modulo: 'smartflow',
    requires: { modulo: 'PAGINA__SMARTFLOW__ATENDIMENTOS', acao: 'VIEW' },
    subItems: [
      { label: 'Atendimentos', path: '/app/smartflow/atendimentos', submodulo: 'atendimentos', requires: { modulo: 'PAGINA__SMARTFLOW__ATENDIMENTOS', acao: 'VIEW' } },
      { label: 'Kanban de Fluxos', path: '/app/smartflow/kanban-fluxos', submodulo: 'kanban-fluxos', requires: { modulo: 'PAGINA__SMARTFLOW__KANBAN_FLUXOS', acao: 'VIEW' } },
    ],
  },
  {
    label: 'COMUNIDADE',
    icon: Sparkles,
    modulo: 'comunidade',
    subItems: [
      { label: 'Chat', path: '/app/comunidade/chat', submodulo: 'chat', requires: { modulo: 'PAGINA__COMUNIDADE__CHAT', acao: 'VIEW' } },
      { label: 'InstaFlow', path: '/app/comunidade', submodulo: 'instaflow', requires: { modulo: 'PAGINA__COMUNIDADE__FEED', acao: 'VIEW' } },
      { label: 'Tarefas', path: '/app/comunidade/taskflow', submodulo: 'taskflow', requires: { modulo: 'PAGINA__COMUNIDADE__TASKFLOW', acao: 'VIEW' } },
      { label: 'Calendário', path: '/app/comunidade/calendario', submodulo: 'calendario', requires: { modulo: 'PAGINA__COMUNIDADE__CALENDARIO', acao: 'VIEW' } },
    ],
  },
  {
    label: 'UNIVERSIDADE',
    icon: GraduationCap,
    modulo: 'universidade',
    requires: { modulo: 'PAGINA__UNIVERSIDADE__CATALOGOS', acao: 'VIEW' },
    subItems: [
      { label: 'Catálogos', path: '/app/universidade/catalogos', submodulo: 'catalogos', requires: { modulo: 'PAGINA__UNIVERSIDADE__CATALOGOS', acao: 'VIEW' } },
      { label: 'Manuais', path: '/app/universidade/manuais', submodulo: 'manuais', requires: { modulo: 'PAGINA__UNIVERSIDADE__MANUAIS', acao: 'VIEW' } },
      { label: 'Treinamentos', path: '/app/universidade/treinamentos', submodulo: 'treinamentos', requires: { modulo: 'PAGINA__UNIVERSIDADE__TREINAMENTOS', acao: 'VIEW' } },
      { label: 'Instruções de Trabalho', path: '/app/universidade/instrucoes-de-trabalho', submodulo: 'instrucoes-de-trabalho', requires: { modulo: 'PAGINA__UNIVERSIDADE__INSTRUCOES_TRABALHO', acao: 'VIEW' } },
    ],
  },
  {
    label: 'CONFIG GERAIS',
    icon: Settings,
    modulo: 'config-gerais',
    subItems: [
      { label: 'Usuários', path: '/app/configuracoes/usuarios', submodulo: 'usuarios', requires: { modulo: 'PAGINA__CONFIGURACOES__USUARIOS', acao: 'VIEW' } },
      { label: 'Perfil', path: '/app/configuracoes/perfil', submodulo: 'perfil' },
      { label: 'Permissões', path: '/app/configuracoes/permissoes', submodulo: 'permissoes', requires: { modulo: 'PAGINA__CONFIGURACOES__PERMISSOES', acao: 'VIEW' } },
      { label: 'Motivos', path: '/app/crm/configs/motivos', submodulo: 'motivos', requires: { modulo: 'PAGINA__CRM__CONFIGS__MOTIVOS', acao: 'VIEW' } },
      { label: 'Verticais', path: '/app/crm/configs/verticais', submodulo: 'verticais', requires: { modulo: 'PAGINA__CRM__CONFIGS__VERTICAIS', acao: 'VIEW' } },
      { label: 'Origem Leads', path: '/app/crm/configs/origem-leads', submodulo: 'origem-leads', requires: { modulo: 'PAGINA__CRM__CONFIGS__ORIGEM_LEADS', acao: 'VIEW' } },
      { label: 'CRM Fase', path: '/app/crm/configs/fases', submodulo: 'fases', requires: { modulo: 'PAGINA__CRM__CONFIGS__FASES', acao: 'VIEW' } },
      { label: 'CRM Status', path: '/app/crm/configs/status', submodulo: 'status', requires: { modulo: 'PAGINA__CRM__CONFIGS__STATUS', acao: 'VIEW' } },
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
  const [docsInvalidMenu, setDocsInvalidMenu] = useState<{
    colabs: 'vencido' | 'vencendo' | null
    empresas: 'vencido' | 'vencendo' | null
  }>({ colabs: null, empresas: null });

  const canSee = useMemo(() => {
    if (!permissions) return (_modulo: string, _acao: string) => false
    const hasPagePerms = (permissions ?? []).some((p: any) => String(p?.modulo || '').startsWith('PAGINA__'))
    return (modulo: string, acao: string) => {
      if (can(modulo, acao)) return true
      if (hasPagePerms) return false
      if (!modulo.startsWith('PAGINA__')) return false
      const base = PAGE_BASE_MODULO_BY_PAGE_MODULO[modulo]
      if (!base) return false
      return can(base, acao)
    }
  }, [can, permissions])

  const visibleNavItems = useMemo(() => {
    return navItems
      .map((item) => {
        const subItems = item.subItems?.filter((sub) => {
          if (!sub.requires) return true
          return canSee(sub.requires.modulo, sub.requires.acao)
        })
        const itemAllowed = !item.requires || canSee(item.requires.modulo, item.requires.acao)
        const hasVisibleSubs = (subItems?.length ?? 0) > 0
        if (!itemAllowed && !hasVisibleSubs) return null
        return { ...item, subItems: subItems ?? item.subItems }
      })
      .filter(Boolean)
      .filter((item: any) => Boolean(item?.path) || (item?.subItems?.length ?? 0) > 0)
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

  useEffect(() => {
    let mounted = true
    const sb = supabase as any
    async function loadInvalidDocs() {
      try {
        const tz = 'America/Sao_Paulo'
        const fmtISO = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
        const hojeISO = fmtISO.format(new Date())
        const addDaysISO = (iso: string, days: number) => {
          const [yy, mm, dd] = iso.split('-').map(Number)
          const base = new Date(Date.UTC(yy, mm - 1, dd))
          base.setUTCDate(base.getUTCDate() + days)
          const y = base.getUTCFullYear()
          const m = String(base.getUTCMonth() + 1).padStart(2, '0')
          const d = String(base.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        }
        const limiteISO = addDaysISO(hojeISO, 30)

        let colabs: 'vencido' | 'vencendo' | null = null
        try {
          const hasAnyActiveColab = async (ids: string[]) => {
            if (ids.length === 0) return false
            try {
              const r2 = await sb.from('colaboradores').select('id, data_demissao').in('id', ids)
              if (r2?.error) throw r2.error
              return (r2?.data ?? []).some((row: any) => !row?.data_demissao)
            } catch {
              return true
            }
          }

          const vencidos = await sb
            .from('colaboradores_documentos')
            .select('colaborador_id')
            .lt('data_vencimento', hojeISO)
            .not('data_vencimento', 'is', null)
            .limit(500)
          if (vencidos?.error) throw vencidos.error
          const idsVencidos = Array.from(
            new Set<string>((vencidos?.data ?? []).map((x: any) => String(x?.colaborador_id || '')).filter(Boolean))
          )
          if (await hasAnyActiveColab(idsVencidos)) {
            colabs = 'vencido'
          } else {
            const vencendo = await sb
              .from('colaboradores_documentos')
              .select('colaborador_id')
              .gte('data_vencimento', hojeISO)
              .lte('data_vencimento', limiteISO)
              .not('data_vencimento', 'is', null)
              .limit(500)
            if (vencendo?.error) throw vencendo.error
            const idsVencendo = Array.from(
              new Set<string>((vencendo?.data ?? []).map((x: any) => String(x?.colaborador_id || '')).filter(Boolean))
            )
            if (await hasAnyActiveColab(idsVencendo)) colabs = 'vencendo'
          }
        } catch (e) {
          colabs = null
        }

        let empresas: 'vencido' | 'vencendo' | null = null
        try {
          const hasAnyActiveEmpresa = async (ids: string[]) => {
            if (ids.length === 0) return false
            try {
              const r2 = await sb.from('fin_empresas_correspondentes').select('empresa_id').in('empresa_id', ids).eq('ativo', true).limit(1)
              if (r2?.error) throw r2.error
              return (r2?.data ?? []).length > 0
            } catch {
              return true
            }
          }

          const vencidos = await sb
            .from('fin_empresas_correspondentes_documentos')
            .select('empresa_id')
            .lt('data_vencimento', hojeISO)
            .not('data_vencimento', 'is', null)
            .limit(500)
          if (vencidos?.error) throw vencidos.error
          const idsVencidos = Array.from(
            new Set<string>((vencidos?.data ?? []).map((x: any) => String(x?.empresa_id || '')).filter(Boolean))
          )
          if (await hasAnyActiveEmpresa(idsVencidos)) {
            empresas = 'vencido'
          } else {
            const vencendo = await sb
              .from('fin_empresas_correspondentes_documentos')
              .select('empresa_id')
              .gte('data_vencimento', hojeISO)
              .lte('data_vencimento', limiteISO)
              .not('data_vencimento', 'is', null)
              .limit(500)
            if (vencendo?.error) throw vencendo.error
            const idsVencendo = Array.from(
              new Set<string>((vencendo?.data ?? []).map((x: any) => String(x?.empresa_id || '')).filter(Boolean))
            )
            if (await hasAnyActiveEmpresa(idsVencendo)) empresas = 'vencendo'
          }
        } catch (e) {
          empresas = null
        }

        if (!mounted) return
        setDocsInvalidMenu({ colabs, empresas })
      } catch (e) {
        if (!mounted) return
        setDocsInvalidMenu({ colabs: null, empresas: null })
      }
    }
    loadInvalidDocs()
    const onRefresh = () => loadInvalidDocs()
    const intervalId = window.setInterval(onRefresh, 60_000)
    window.addEventListener('systemflow:refreshAdminDocsAlert', onRefresh)
    return () => {
      mounted = false
      window.clearInterval(intervalId)
      window.removeEventListener('systemflow:refreshAdminDocsAlert', onRefresh)
    }
  }, [])

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
  const profileName = profile?.nome || 'Usuário';
  const profileInitial = profileName.substring(0, 1).toUpperCase();

  return (
    <>
      {/* LOGO */}
      <div className={`h-16 flex items-center shrink-0 border-b border-[var(--border)] transition-all duration-300
        ${showText ? 'px-5 justify-start' : 'px-0 justify-center'}`}>
        <div className="flex items-center gap-2.5">
          <img
            src="https://apliflow.com.br/wp-content/uploads/2024/06/af-prata-e-azul-1-1.png"
            alt="SystemFlow"
            className={`transition-all duration-300 object-contain ${showText ? 'h-6' : 'h-5'}`}
            draggable={false}
          />
        </div>

        {isMobileMenuOpen && (
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="ml-auto p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* NAVIGATION */}
      <nav className={`flex-1 py-4 overflow-y-auto custom-scrollbar bg-[var(--bg-panel)]
        ${showText ? 'px-3' : 'px-2'}`}>

        {visibleNavItems.map((item) => {
          const isExpanded = expandedMenu === item.label;
          const hasActiveChild = hasActivePath(item, location.pathname);
          const isActive = hasActiveChild || isExpanded;

          return (
            <div key={item.label} className="mb-0.5 relative group">
              {/* Section button */}
              <button
                onClick={() => toggleMenu(item.label)}
                className={`w-full flex items-center rounded-lg transition-all duration-150
                  ${showText
                    ? 'justify-between px-3 py-2'
                    : 'justify-center p-2.5'
                  }
                  ${isActive
                    ? 'text-[var(--text-main)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-soft)] hover:bg-white/[0.04]'
                  }
                `}
              >
                <div className={`flex items-center ${showText ? 'gap-3' : ''}`}>
                  <div className="relative shrink-0">
                    <item.icon
                      size={showText ? 16 : 18}
                      strokeWidth={isActive ? 2 : 1.75}
                      className={isActive ? 'text-[var(--primary)]' : ''}
                    />
                    {/* Unread dot — comunidade */}
                    {item.modulo === 'comunidade' && hasAnyChatUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[var(--primary)] rounded-full" />
                    )}
                    {/* Alert — administrativo */}
                    {item.label === 'ADMINISTRATIVO' && (docsInvalidMenu.colabs || docsInvalidMenu.empresas) && (
                      <span className="absolute -top-1 -right-1 p-0.5 rounded bg-[var(--bg-panel)]">
                        <AlertTriangle
                          size={11}
                          className={
                            docsInvalidMenu.colabs === 'vencido' || docsInvalidMenu.empresas === 'vencido'
                              ? 'text-[var(--danger)]'
                              : 'text-[var(--warning)]'
                          }
                        />
                      </span>
                    )}
                  </div>
                  {showText && (
                    <span className={`text-xs font-bold tracking-widest uppercase transition-colors ${isActive ? 'text-[var(--text-main)]' : ''}`}>
                      {item.label}
                    </span>
                  )}
                </div>

                {showText && (
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 shrink-0 ${isActive ? 'text-[var(--text-soft)]' : 'text-[var(--text-muted)] opacity-60'} ${isExpanded ? 'rotate-180' : ''}`}
                  />
                )}
              </button>

              {/* Collapsed tooltip */}
              {!showText && (
                <div className="pointer-events-none hidden group-hover:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--bg-card)] text-[var(--text-main)] text-xs font-medium rounded-lg shadow-[var(--shadow-soft)] border border-[var(--border)] whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}

              {/* Submenu */}
              {showText && isExpanded && (
                <div className="mt-0.5 ml-2 pl-3 border-l border-[var(--border)] space-y-0.5 pb-1">
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
                          className={`flex items-center justify-between px-3 py-1.5 rounded-md text-[13px] transition-colors duration-150
                            ${active
                              ? 'text-[var(--primary)] bg-[var(--primary-soft)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-soft)] hover:bg-white/[0.04]'
                            }`}
                        >
                          <span className={active ? 'font-medium' : ''}>{sub.label}</span>
                          <div className="flex items-center gap-1.5">
                            {sub.path === '/app/comunidade/chat' && hasAnyChatUnread && (
                              <span className="w-1.5 h-1.5 bg-[var(--primary)] rounded-full" />
                            )}
                            {sub.path === '/app/administrativo/colaboradores' && docsInvalidMenu.colabs && (
                              <AlertTriangle
                                size={12}
                                className={docsInvalidMenu.colabs === 'vencido' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}
                              />
                            )}
                            {sub.path === '/app/financeiro/empresas-correspondentes' && docsInvalidMenu.empresas && (
                              <AlertTriangle
                                size={12}
                                className={docsInvalidMenu.empresas === 'vencido' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}
                              />
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
                          className={`w-full px-3 py-1.5 rounded-md text-[13px] transition-colors duration-150 flex items-center justify-between
                            ${nestedActive
                              ? 'text-[var(--primary)] bg-[var(--primary-soft)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-soft)] hover:bg-white/[0.04]'
                            }`}
                        >
                          <span className={nestedActive ? 'font-medium' : ''}>{sub.label}</span>
                          <ChevronDown
                            size={12}
                            className={`transition-transform duration-200 opacity-50 ${isSubExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isSubExpanded && (
                          <div className="ml-3 pl-3 border-l border-[var(--border)] space-y-0.5">
                            {sub.subItems?.map((nested) => {
                              const active = location.pathname === nested.path
                              return (
                                <Link
                                  key={nested.path}
                                  to={nested.path}
                                  className={`block px-3 py-1.5 rounded-md text-[13px] transition-colors duration-150
                                    ${active
                                      ? 'text-[var(--primary)] bg-[var(--primary-soft)] font-medium'
                                      : 'text-[var(--text-muted)] hover:text-[var(--text-soft)] hover:bg-white/[0.04]'
                                    }`}
                                >
                                  {nested.label}
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

      {/* FOOTER — User */}
      <div className={`shrink-0 border-t border-[var(--border)] bg-[var(--bg-panel)] transition-all duration-300
        ${showText ? 'p-3' : 'py-4 flex flex-col items-center gap-3'}`}>

        {showText ? (
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <button
              onClick={openProfilePage}
              className="relative group shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-[var(--primary)]/30">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-[var(--text-soft)]">{profileInitial}</span>
                )}
              </div>
            </button>

            {/* Name + role */}
            <button
              onClick={openProfilePage}
              className="flex-1 min-w-0 text-left group"
            >
              <p className="text-[13px] font-medium text-[var(--text-main)] truncate leading-none group-hover:text-[var(--primary)] transition-colors">
                {profileName}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                {profile?.cargo || 'Membro'}
              </p>
            </button>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => navigate('/app/configuracoes/perfil')}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/[0.06] transition-colors"
                title="Perfil"
              >
                <User size={14} />
              </button>
              <button
                onClick={handleLogoutClick}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                title="Sair"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={openProfilePage}
              className="relative group"
              title={profileName}
            >
              <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-[var(--primary)]/40 group-hover:scale-105">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-[var(--text-soft)]">{profileInitial}</span>
                )}
              </div>
              {/* Tooltip */}
              <div className="pointer-events-none hidden group-hover:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--bg-card)] text-[var(--text-main)] text-xs font-medium rounded-lg shadow-[var(--shadow-soft)] border border-[var(--border)] whitespace-nowrap z-50">
                {profileName}
              </div>
            </button>

            <button
              onClick={handleLogoutClick}
              className="group relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
              title="Sair"
            >
              <LogOut size={15} />
              <div className="pointer-events-none hidden group-hover:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--bg-card)] text-[var(--text-main)] text-xs font-medium rounded-lg shadow-[var(--shadow-soft)] border border-[var(--border)] whitespace-nowrap z-50">
                Sair
              </div>
            </button>
          </>
        )}
      </div>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
};
