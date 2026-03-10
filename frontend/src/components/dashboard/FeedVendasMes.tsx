import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/services/supabase'
import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import { APP_TIME_ZONE } from '@/constants/timezone'
import { Briefcase, CalendarDays, Trophy, User, Zap } from 'lucide-react'

const FASE_CONQUISTADO_ID = '88a8b9bb-30db-4eb7-a351-182daeeb0f02'

type Venda = {
  id: string
  cliente: string
  vendedor: string
  vendedor_avatar_url?: string | null
  produto: string
  valor: number
  data_conquistado: string
  is_new?: boolean
}

export function FeedVendasMes() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sb = supabase as any

  const currency = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  const somVendaUrl = useMemo(() => {
    return new URL('../../assets/sounds/som_venda.mp3', import.meta.url).href
  }, [])

  const getMonthRange = () => {
    const now = new Date()
    const spNow = new Date(now.toLocaleString('en-US', { timeZone: APP_TIME_ZONE }))
    const start = startOfMonth(spNow)
    const nextStart = startOfMonth(addMonths(start, 1))
    return { start, nextStart }
  }

  const toVenda = (row: any): Venda | null => {
    const id = String(row?.id_oport || row?.id_oportunidade || row?.id || '').trim()
    const dataConquistado = String(row?.data_conquistado || '').trim()
    if (!id || !dataConquistado) return null

    const vendedor = String(row?.vendedor_nome || row?.vendedor || 'Vendedor não identificado').trim() || 'Vendedor não identificado'
    const cliente = String(row?.cliente_nome || row?.cliente || 'Cliente não identificado').trim() || 'Cliente não identificado'
    const solucao = String(row?.solucao || '').trim().toUpperCase()
    const produto = solucao === 'PRODUTO' ? 'Produto' : solucao === 'SERVICO' ? 'Serviço' : 'Produto/Serviço'
    const valor = Number(row?.ticket_valor || row?.valor_proposta || 0)

    return {
      id,
      cliente,
      vendedor,
      vendedor_avatar_url: row?.vendedor_avatar_url ?? row?.avatar_url ?? null,
      produto,
      valor: Number.isFinite(valor) ? valor : 0,
      data_conquistado: dataConquistado,
      is_new: false
    }
  }

  const initials = (name: string) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] || ''
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : (parts[0]?.[1] || '')
    const out = `${a}${b}`.trim().toUpperCase()
    return out || '—'
  }

  const safeDate = (iso: string) => {
    const raw = String(iso || '').trim()
    if (!raw) return '—'
    try {
      return format(parseISO(raw), 'dd/MM/yyyy')
    } catch {
      return '—'
    }
  }

  useEffect(() => {
    audioRef.current = new Audio(somVendaUrl)
  }, [somVendaUrl])

  useEffect(() => {
    fetchVendasIniciais()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('feed-vendas-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_oportunidades',
        },
        async (payload) => {
          const newRec = payload.new as any
          
          if (
            String(newRec?.id_fase || '').trim() === FASE_CONQUISTADO_ID &&
            String(newRec?.data_conquistado || '').trim()
          ) {
            const { start, nextStart } = getMonthRange()
            const parsed = (() => {
              try {
                return parseISO(newRec.data_conquistado)
              } catch {
                return null
              }
            })()

            if (parsed && parsed.getTime() >= start.getTime() && parsed.getTime() < nextStart.getTime()) {
              const venda = toVenda(newRec)
              if (!venda) return

              setVendas((prev) => {
                const exists = prev.some((v) => v.id === venda.id)
                if (!exists) playSound()

                const next = [
                  { ...venda, is_new: !exists },
                  ...prev.filter((v) => v.id !== venda.id).map((v) => ({ ...v, is_new: false }))
                ]
                  .sort((a, b) => new Date(b.data_conquistado).getTime() - new Date(a.data_conquistado).getTime())
                  .slice(0, 20)

                return next
              })
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => null)
    }
  }

  const fetchVendasIniciais = async () => {
    const { start, nextStart } = getMonthRange()
    const startIso = start.toISOString()
    const nextStartIso = nextStart.toISOString()

    const { data, error } = await sb
      .from('crm_oportunidades')
      .select('*')
      .eq('id_fase', FASE_CONQUISTADO_ID)
      .not('data_conquistado', 'is', null)
      .gte('data_conquistado', startIso)
      .lt('data_conquistado', nextStartIso)
      .order('data_conquistado', { ascending: false })
      .limit(20)

    if (error) {
      const status = typeof error?.status === 'number' ? ` (${error.status})` : ''
      setLoadError(`${String(error?.message || 'Falha ao carregar vendas.')}${status}`)
      return
    }

    const list = (data || [])
      .map((row: any) => toVenda(row))
      .filter(Boolean) as Venda[]

    setLoadError(null)
    setVendas(
      list
        .sort((a, b) => new Date(b.data_conquistado).getTime() - new Date(a.data_conquistado).getTime())
        .slice(0, 20)
    )
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow-card)] border border-[var(--border)] flex flex-col h-full">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent rounded-t-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h2 className="font-black text-[var(--text-main)] text-base sm:text-lg tracking-tight truncate">Feed de Vendas</h2>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-[10px] sm:text-xs text-emerald-300/90 font-bold uppercase tracking-wider">Tempo real • Mês atual</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--text-soft)]">
            Últimas 20
          </span>
          <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            Conquistado
          </span>
        </div>
      </div>

      <div className="h-[360px] sm:h-[420px] overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar" ref={listRef}>
        {loadError ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-90 min-h-[200px] text-center">
            <Trophy className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-black text-[var(--text-main)] tracking-tight">Falha ao carregar o feed</p>
            <p className="text-xs mt-1 max-w-[340px] text-[var(--text-soft)]">{loadError}</p>
            <button
              type="button"
              onClick={() => fetchVendasIniciais()}
              className="mt-3 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-[var(--text-main)] text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        ) : vendas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-70 min-h-[200px] text-center">
            <Trophy className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-semibold text-[var(--text-main)]">Nenhuma venda registrada este mês</p>
            <p className="text-xs mt-1 text-[var(--text-soft)]">Quando uma venda entrar, ela aparece aqui automaticamente.</p>
          </div>
        ) : (
            vendas.map((venda) => (
                <div 
                    key={venda.id}
                    className={[
                      'relative overflow-hidden rounded-2xl border transition-all duration-300 ease-out group',
                      'p-4 sm:p-4.5',
                      venda.is_new
                        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[var(--shadow-soft)]'
                        : 'bg-[var(--bg-panel)] border-[var(--border)] hover:border-white/15 hover:bg-[var(--bg-panel)]/80'
                    ].join(' ')}
                >
                    {venda.is_new && (
                      <>
                        <div className="absolute inset-y-0 left-0 w-1 bg-emerald-400/80" />
                        <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full shadow-sm z-10 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          NOVA
                        </div>
                      </>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-11 h-11 min-w-[2.75rem] rounded-full overflow-hidden border border-white/10 bg-emerald-500/10 shadow-sm">
                          {venda.vendedor_avatar_url ? (
                            <>
                              <img
                                src={venda.vendedor_avatar_url}
                                alt={venda.vendedor}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const fallback = target.nextElementSibling
                                  if (fallback) fallback.classList.remove('hidden')
                                }}
                              />
                              <div className="hidden absolute inset-0 flex items-center justify-center text-emerald-200 font-black text-xs bg-emerald-500/10">
                                {initials(venda.vendedor)}
                              </div>
                            </>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-emerald-200 font-black text-xs bg-emerald-500/10">
                              {initials(venda.vendedor)}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-black text-[var(--text-main)] text-base leading-tight tracking-tight truncate">
                              {venda.vendedor}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-soft)] mt-1 min-w-0">
                            <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <span className="truncate">{venda.cliente}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col sm:items-end justify-between sm:justify-start gap-2">
                        <span className="font-black text-emerald-300 text-sm sm:text-base tabular-nums">
                          {currency.format(venda.valor)}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span className="font-semibold">{safeDate(venda.data_conquistado)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-dashed border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Briefcase className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span className="text-xs font-bold text-[var(--text-soft)] truncate" title={venda.produto}>
                          {venda.produto}
                        </span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--text-muted)]">
                        CONQUISTA
                      </span>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
}
