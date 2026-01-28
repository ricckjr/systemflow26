import React, { useMemo, useState } from 'react'
import { Car } from 'lucide-react'
import { useFrotaVeiculos } from '@/hooks/useFrota'
import { formatFrotaVeiculoStatus, FrotaVeiculo } from '@/services/frota'

const Veiculos: React.FC = () => {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'lista' | 'cards'>('lista')

  const { data, isLoading, isError, error } = useFrotaVeiculos()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const vehicles = (data ?? []) as FrotaVeiculo[]
    if (!q) return vehicles
    return vehicles.filter((v) => {
      const haystack = `${v.placa} ${v.modelo ?? ''} ${v.marca ?? ''} ${v.tipo ?? ''} ${v.status}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, data])

  return (
    <div className="pt-4 pb-6 max-w-[1600px] mx-auto px-4 md:px-6">
      <div className="flex items-center gap-2 mb-4 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
        <Car size={14} />
        Frota · Veículos
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-[var(--text)]">Veículos</h1>
            <p className="text-[13px] text-[var(--text-muted)]">
              Cadastro e gestão da frota (estrutura pronta para integrações).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`h-9 px-3 rounded-lg border text-[12px] font-semibold transition ${
                view === 'lista'
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : 'border-[var(--border)] bg-transparent text-[var(--text-soft)] hover:bg-white/5'
              }`}
              onClick={() => setView('lista')}
            >
              Lista
            </button>
            <button
              type="button"
              className={`h-9 px-3 rounded-lg border text-[12px] font-semibold transition ${
                view === 'cards'
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : 'border-[var(--border)] bg-transparent text-[var(--text-soft)] hover:bg-white/5'
              }`}
              onClick={() => setView('cards')}
            >
              Cards
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-[var(--border)] bg-white/5 text-[12px] font-semibold text-[var(--text)] hover:bg-white/10 transition"
              disabled
              title="Em breve"
            >
              Novo veículo
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por placa, modelo, marca..."
              className="w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--text)] placeholder:text-[var(--text-soft)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-10 px-3 rounded-xl border border-[var(--border)] bg-transparent text-[12px] font-semibold text-[var(--text-soft)] hover:bg-white/5 transition"
              disabled
              title="Em breve"
            >
              Filtros
            </button>
            <button
              type="button"
              className="h-10 px-3 rounded-xl border border-[var(--border)] bg-transparent text-[12px] font-semibold text-[var(--text-soft)] hover:bg-white/5 transition"
              disabled
              title="Em breve"
            >
              Exportar
            </button>
          </div>
        </div>

        <div className="mt-5">
          {isLoading ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-[13px] text-[var(--text-soft)]">
              Carregando veículos...
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-[13px] text-red-200">
              Falha ao carregar veículos: {(error as any)?.message ?? 'Erro desconhecido'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-[13px] text-[var(--text-soft)]">
              Nenhum veículo encontrado.
            </div>
          ) : view === 'lista' ? (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-white/5 text-[11px] font-bold tracking-widest uppercase text-[var(--text-soft)]">
                <div className="col-span-2">Placa</div>
                <div className="col-span-3">Modelo</div>
                <div className="col-span-3">Marca</div>
                <div className="col-span-2">Tipo</div>
                <div className="col-span-2">Status</div>
              </div>
              <div className="divide-y divide-white/5">
                {filtered.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-12 gap-2 px-4 py-3 text-[13px] text-[var(--text)] hover:bg-white/5 transition"
                  >
                    <div className="col-span-2 font-semibold">{v.placa}</div>
                    <div className="col-span-3">{v.modelo ?? '-'}</div>
                    <div className="col-span-3">{v.marca ?? '-'}</div>
                    <div className="col-span-2">{v.tipo ?? '-'}</div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center h-6 px-2 rounded-md border border-white/10 bg-white/5 text-[12px] text-[var(--text-soft)]">
                        {formatFrotaVeiculoStatus(v.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 hover:bg-white/5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[var(--text)]">{v.placa}</p>
                      <p className="text-[13px] text-[var(--text-muted)] truncate">
                        {(v.marca ?? '-') + (v.modelo ? ` · ${v.modelo}` : '')}
                      </p>
                    </div>
                    <span className="inline-flex items-center h-6 px-2 rounded-md border border-white/10 bg-white/5 text-[12px] text-[var(--text-soft)]">
                      {formatFrotaVeiculoStatus(v.status)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-[var(--text-muted)]">
                    <div>
                      <span className="text-[var(--text-soft)] font-semibold">Ano:</span> {v.ano ?? '-'}
                    </div>
                    <div>
                      <span className="text-[var(--text-soft)] font-semibold">Tipo:</span> {v.tipo ?? '-'}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 px-3 rounded-lg border border-[var(--border)] bg-transparent text-[12px] font-semibold text-[var(--text-soft)] hover:bg-white/5 transition"
                      disabled
                      title="Em breve"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="h-9 px-3 rounded-lg border border-[var(--border)] bg-transparent text-[12px] font-semibold text-[var(--text-soft)] hover:bg-white/5 transition"
                      disabled
                      title="Em breve"
                    >
                      Inativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Veiculos
