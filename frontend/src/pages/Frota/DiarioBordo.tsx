import React, { useMemo, useState } from 'react'
import { NotebookText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFrotaDiarioBordo, useFrotaVeiculos } from '@/hooks/useFrota'
import { fetchProfiles } from '@/services/profiles'
import { Profile } from '@/types'

const DiarioBordo: React.FC = () => {
  const [fVeiculoId, setFVeiculoId] = useState('')
  const [fResponsavelId, setFResponsavelId] = useState('')
  const [fInicio, setFInicio] = useState('')
  const [fFim, setFFim] = useState('')

  const veiculosQuery = useFrotaVeiculos()
  const responsaveisQuery = useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: fetchProfiles,
    staleTime: 1000 * 60 * 10,
    retry: 2,
  })

  const diarioQuery = useFrotaDiarioBordo({
    veiculoId: fVeiculoId || undefined,
    responsavelId: fResponsavelId || undefined,
    inicio: fInicio || undefined,
    fim: fFim || undefined,
  })

  const rows = useMemo(() => {
    return (diarioQuery.data ?? []).map((r) => {
      const placa = r.frota_veiculos?.placa ?? '-'
      const marca = r.frota_veiculos?.marca ?? ''
      const responsavel = r.profiles?.nome ?? '-'
      return {
        id: r.id,
        data: r.data_utilizacao,
        veiculo: [placa, marca].filter(Boolean).join(' · '),
        responsavel,
        kmInicial: r.km_inicial,
        kmFinal: r.km_final,
        destino: r.destino,
      }
    })
  }, [diarioQuery.data])

  return (
    <div className="pt-4 pb-6 max-w-[1600px] mx-auto px-4 md:px-6">
      <div className="flex items-center gap-2 mb-4 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
        <NotebookText size={14} />
        Frota · Diário de Bordo
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-[var(--text)]">Diário de Bordo</h1>
            <p className="text-[13px] text-[var(--text-muted)]">
              Histórico de uso dos veículos (sem exclusão; correções serão registradas com rastreabilidade).
            </p>
          </div>

          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-[var(--border)] bg-white/5 text-[12px] font-semibold text-[var(--text)] hover:bg-white/10 transition"
            disabled
            title="Em breve"
          >
            Novo registro
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={fVeiculoId}
            onChange={(e) => setFVeiculoId(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            disabled={veiculosQuery.isLoading || veiculosQuery.isError}
          >
            <option value="">Todos os veículos</option>
            {(veiculosQuery.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa}
              </option>
            ))}
          </select>
          <select
            value={fResponsavelId}
            onChange={(e) => setFResponsavelId(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            disabled={responsaveisQuery.isLoading || responsaveisQuery.isError}
          >
            <option value="">Todos os responsáveis</option>
            {((responsaveisQuery.data ?? []) as Profile[]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <input
            value={fInicio}
            onChange={(e) => setFInicio(e.target.value)}
            type="date"
            className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
          <input
            value={fFim}
            onChange={(e) => setFFim(e.target.value)}
            type="date"
            className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>

        <div className="mt-5 rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-white/5 text-[11px] font-bold tracking-widest uppercase text-[var(--text-soft)]">
            <div className="col-span-2">Data</div>
            <div className="col-span-3">Veículo</div>
            <div className="col-span-3">Responsável</div>
            <div className="col-span-1 text-right">KM inicial</div>
            <div className="col-span-1 text-right">KM final</div>
            <div className="col-span-2">Destino</div>
          </div>

          <div className="divide-y divide-white/5">
            {diarioQuery.isLoading ? (
              <div className="px-4 py-4 text-[13px] text-[var(--text-soft)]">Carregando registros...</div>
            ) : diarioQuery.isError ? (
              <div className="px-4 py-4 text-[13px] text-red-200 bg-red-500/10">
                Falha ao carregar diário de bordo: {(diarioQuery.error as any)?.message ?? 'Erro desconhecido'}
              </div>
            ) : rows.length === 0 ? (
              <div className="px-4 py-4 text-[13px] text-[var(--text-soft)]">Nenhum registro encontrado.</div>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-[13px] text-[var(--text)] hover:bg-white/5 transition">
                  <div className="col-span-2 text-[var(--text-soft)]">{r.data}</div>
                  <div className="col-span-3 font-semibold">{r.veiculo}</div>
                  <div className="col-span-3">{r.responsavel}</div>
                  <div className="col-span-1 text-right tabular-nums text-[var(--text-soft)]">{r.kmInicial}</div>
                  <div className="col-span-1 text-right tabular-nums text-[var(--text-soft)]">{r.kmFinal}</div>
                  <div className="col-span-2">{r.destino}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-[var(--text-soft)]">
          Validações do módulo: KM final ≥ KM inicial; veículo e responsável obrigatórios; histórico imutável (sem DELETE/UPDATE).
        </div>
      </div>
    </div>
  )
}

export default DiarioBordo
