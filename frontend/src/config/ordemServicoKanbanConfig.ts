export interface OsKanbanColumnConfig {
  id: string
  label: string
  color: string
  bg: string
  border: string
  iconColor: string
}

export const OS_KANBAN_CONFIG: Record<string, OsKanbanColumnConfig> = {
  'ANALISE': {
    id: 'ANALISE',
    label: 'Análise Técnica',
    color: 'text-blue-400',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    iconColor: 'text-blue-500'
  },
  'AGUARDANDO CLIENTE': {
    id: 'AGUARDANDO CLIENTE',
    label: 'Aguardando Aprovação',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/5',
    border: 'border-yellow-500/20',
    iconColor: 'text-yellow-500'
  },
  'CALIBRACAO': {
    id: 'CALIBRACAO',
    label: 'Laboratorio',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/5',
    border: 'border-indigo-500/20',
    iconColor: 'text-indigo-500'
  },
  'OFICINA': {
    id: 'OFICINA',
    label: 'Oficina',
    color: 'text-sky-400',
    bg: 'bg-sky-500/5',
    border: 'border-sky-500/20',
    iconColor: 'text-sky-500'
  },
  'Serviço Terceirizado': {
    id: 'Serviço Terceirizado',
    label: 'Serviço Terceirizado',
    color: 'text-amber-400',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-500'
  },
  'LAVADOR': {
    id: 'LAVADOR',
    label: 'Descontaminação',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/20',
    iconColor: 'text-cyan-500'
  },
  'PREPARO-PINTURA': {
    id: 'PREPARO-PINTURA',
    label: 'Estufa de Pintura',
    color: 'text-purple-400',
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/20',
    iconColor: 'text-purple-500'
  },
  'ELETRONICA': {
    id: 'ELETRONICA',
    label: 'Eletrônica',
    color: 'text-violet-400',
    bg: 'bg-violet-500/5',
    border: 'border-violet-500/20',
    iconColor: 'text-violet-500'
  },
  'SERVICO_EXTERNO': {
    id: 'SERVICO_EXTERNO',
    label: 'Serviço Externo',
    color: 'text-orange-400',
    bg: 'bg-orange-500/5',
    border: 'border-orange-500/20',
    iconColor: 'text-orange-500'
  },
  'PREPARO FINAL': {
    id: 'PREPARO FINAL',
    label: 'Qualidade',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-500'
  },
  'FINALIZADO': {
    id: 'FINALIZADO',
    label: 'Concluído',
    color: 'text-slate-400',
    bg: 'bg-slate-500/5',
    border: 'border-slate-500/20',
    iconColor: 'text-slate-500'
  }
}

export const OS_PHASES = [
  'ANALISE',
  'AGUARDANDO CLIENTE',
  'CALIBRACAO',
  'LAVADOR',
  'OFICINA',
  'PREPARO-PINTURA',
  'ELETRONICA',
  'SERVICO_EXTERNO',
  'Serviço Terceirizado',
  'PREPARO FINAL',
  'FINALIZADO'
] as const

export const normalizeOsPhase = (phase: string) => {
  const p = (phase || '').trim()
  if (!p) return ''
  if (p === 'CALIBRACAO_EXTERNA') return 'Serviço Terceirizado'
  if (p === 'LABORATORIO') return 'CALIBRACAO'
  if (p === 'CONCLUIDO' || p === 'CONCLUÍDO') return 'FINALIZADO'
  if (p === 'OFICINA_REPARO' || p === 'OFICINA DE REPARO') return 'OFICINA'
  if (p === 'CALIBRAÇÃO') return 'CALIBRACAO'
  return p
}

export const getOsPhaseConfig = (phase: string) => {
  const normalized = normalizeOsPhase(phase)
  return OS_KANBAN_CONFIG[normalized] || {
    id: normalized,
    label: normalized,
    color: 'text-gray-400',
    bg: 'bg-gray-500/5',
    border: 'border-gray-500/20',
    iconColor: 'text-gray-500'
  }
}
