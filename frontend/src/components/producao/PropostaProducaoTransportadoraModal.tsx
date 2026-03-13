import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Truck, Wrench } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { HorizontalScrollArea } from '@/components/ui/HorizontalScrollArea'
import { EquipmentEntryModal } from '@/components/producao/EquipmentEntryModal'
import { EquipmentList } from '@/components/producao/EquipmentList'
import { UsuarioSimples } from '@/hooks/useUsuarios'
import { CRM_Oportunidade, fetchOportunidadeById, updateOportunidade } from '@/services/crm'
import { useToast } from '@/contexts/ToastContext'

type TabId = 'producao' | 'transportadora'

function parseMoneyPtBr(raw: string) {
  const s = String(raw || '').trim()
  if (!s) return null
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const v = Number.parseFloat(cleaned)
  if (!Number.isFinite(v)) return null
  return v
}

function parseNumberPtBr(raw: string) {
  const s = String(raw || '').trim()
  if (!s) return null
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const v = Number.parseFloat(cleaned)
  if (!Number.isFinite(v)) return null
  return v
}

const getCodProposta = (o: CRM_Oportunidade) => String((o as any).cod_oport ?? (o as any).cod_oportunidade ?? '').trim()
const getCliente = (o: CRM_Oportunidade) => String((o as any).cliente_nome ?? (o as any).cliente ?? '').trim()

export function PropostaProducaoTransportadoraModal(props: {
  isOpen: boolean
  oportunidadeId: string | null
  onClose: () => void
  usuarios: UsuarioSimples[]
  statusLabel?: string | null
}) {
  const { isOpen, oportunidadeId, onClose, usuarios, statusLabel } = props
  const { pushToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<CRM_Oportunidade | null>(null)
  const [tab, setTab] = useState<TabId>('producao')

  const [equipmentEntryOpen, setEquipmentEntryOpen] = useState(false)
  const [equipmentLastUpdate, setEquipmentLastUpdate] = useState(0)

  const [draftRemetenteCompleto, setDraftRemetenteCompleto] = useState('')
  const [draftDestinatarioCompleto, setDraftDestinatarioCompleto] = useState('')
  const [draftNumeroNotaFiscal, setDraftNumeroNotaFiscal] = useState('')
  const [draftValorNotaFiscal, setDraftValorNotaFiscal] = useState('')
  const [draftTransportadora, setDraftTransportadora] = useState('')
  const [draftMaterial, setDraftMaterial] = useState('')
  const [draftQuantidadeVolumes, setDraftQuantidadeVolumes] = useState('')
  const [draftEspecie, setDraftEspecie] = useState('')
  const [draftPeso, setDraftPeso] = useState('')
  const [draftMedidas, setDraftMedidas] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const vendedorProfile = useMemo(() => {
    if (!active) return null
    const id = String((active as any).id_vendedor || '').trim()
    if (id) {
      const byId = usuarios.find((u) => String(u.id || '').trim() === id)
      if (byId) return byId
    }
    const name = String((active as any).vendedor_nome || (active as any).vendedor || '').trim()
    if (!name) return null
    return usuarios.find((u) => String(u.nome || '').trim() === name) || null
  }, [active, usuarios])

  const equipmentInitialData = useMemo(() => {
    if (!active) return {} as any
    const email = String((vendedorProfile as any)?.email_login || (vendedorProfile as any)?.email_corporativo || '').trim()
    return {
      cod_proposta: getCodProposta(active),
      cliente: getCliente(active),
      cnpj: String((active as any).cliente_documento || '').trim(),
      solucao: (active as any).solucao,
      vendedor: String((active as any).vendedor_nome || (active as any).vendedor || (vendedorProfile as any)?.nome || '').trim() || null,
      email_vendedor: email || null,
      empresa_correspondente: String((active as any).empresa_correspondente || '').trim() || null
    } as any
  }, [active, vendedorProfile])

  const canOpenEquipmentEntry = useMemo(() => {
    if (!active) return false
    const cod = String((equipmentInitialData as any)?.cod_proposta || '').trim()
    const cliente = String((equipmentInitialData as any)?.cliente || '').trim()
    return !!cod && !!cliente && !saving
  }, [active, equipmentInitialData, saving])

  useEffect(() => {
    if (!isOpen) return
    const id = String(oportunidadeId || '').trim()
    if (!id) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setSaveError(null)
    setTab('producao')

    ;(async () => {
      try {
        const fetched = await fetchOportunidadeById(id)
        if (cancelled) return
        setActive(fetched)
        setDraftRemetenteCompleto(String((fetched as any)?.remetente_completo || '').trim())
        setDraftDestinatarioCompleto(String((fetched as any)?.destinatario_completo || '').trim())
        setDraftNumeroNotaFiscal(String((fetched as any)?.numero_nota_fiscal || '').trim())
        setDraftValorNotaFiscal(
          (fetched as any)?.valor_nota_fiscal === null || (fetched as any)?.valor_nota_fiscal === undefined ? '' : String((fetched as any)?.valor_nota_fiscal)
        )
        setDraftMaterial(String((fetched as any)?.material || '').trim())
        setDraftQuantidadeVolumes(
          (fetched as any)?.quantidade_volumes === null || (fetched as any)?.quantidade_volumes === undefined ? '' : String((fetched as any)?.quantidade_volumes)
        )
        setDraftEspecie(String((fetched as any)?.especie || '').trim())
        setDraftPeso((fetched as any)?.peso === null || (fetched as any)?.peso === undefined ? '' : String((fetched as any)?.peso))
        setDraftMedidas(String((fetched as any)?.medidas || '').trim())
        setDraftTransportadora(String((fetched as any)?.transportadora || '').trim())
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Falha ao carregar a proposta.'
        setError(msg)
        pushToast({ kind: 'system', title: 'Logística', message: msg })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, oportunidadeId, pushToast])

  const handleSaveTransportadora = useCallback(async () => {
    const id = String(oportunidadeId || '').trim()
    if (!id) return
    if (saving) return

    const valorNotaFiscal = parseMoneyPtBr(draftValorNotaFiscal)
    if (draftValorNotaFiscal.trim() && (valorNotaFiscal === null || valorNotaFiscal <= 0)) {
      setSaveError('Valor da Nota Fiscal inválido.')
      return
    }
    const quantidadeVolumesRaw = draftQuantidadeVolumes.trim()
    const quantidadeVolumes = quantidadeVolumesRaw ? Number.parseInt(quantidadeVolumesRaw, 10) : null
    if (quantidadeVolumesRaw && !Number.isFinite(quantidadeVolumes as any)) {
      setSaveError('Quantidade de volumes inválida.')
      return
    }
    const pesoRaw = draftPeso.trim()
    const peso = pesoRaw ? parseNumberPtBr(pesoRaw) : null
    if (pesoRaw && peso === null) {
      setSaveError('Peso inválido.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await updateOportunidade(id, {
        remetente_completo: draftRemetenteCompleto.trim() || null,
        destinatario_completo: draftDestinatarioCompleto.trim() || null,
        numero_nota_fiscal: draftNumeroNotaFiscal.trim() || null,
        valor_nota_fiscal: valorNotaFiscal,
        material: draftMaterial.trim() || null,
        quantidade_volumes: quantidadeVolumes,
        especie: draftEspecie.trim() || null,
        peso,
        medidas: draftMedidas.trim() || null,
        transportadora: draftTransportadora.trim() || null
      } as any)
      pushToast({ kind: 'system', title: 'Transportadora', message: 'Dados salvos.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar.'
      setSaveError(msg)
      pushToast({ kind: 'system', title: 'Transportadora', message: msg })
    } finally {
      setSaving(false)
    }
  }, [
    draftDestinatarioCompleto,
    draftEspecie,
    draftMaterial,
    draftMedidas,
    draftNumeroNotaFiscal,
    draftPeso,
    draftQuantidadeVolumes,
    draftRemetenteCompleto,
    draftTransportadora,
    draftValorNotaFiscal,
    oportunidadeId,
    pushToast,
    saving
  ])

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (saving) return
          onClose()
        }}
        size="4xl"
        zIndex={150}
        title={
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] shrink-0">
                <Truck size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Proposta Comercial</div>
                <div className="mt-1 text-lg font-black text-[var(--text-main)] truncate">{active ? getCodProposta(active) || '-' : '-'}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{active ? getCliente(active) || '-' : '-'}</div>
              </div>
            </div>
            {statusLabel ? (
              <span className="text-xs font-bold px-2 py-1 rounded-lg border bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-main)] uppercase whitespace-nowrap">
                {statusLabel}
              </span>
            ) : null}
          </div>
        }
        footer={
          tab === 'transportadora' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)] disabled:opacity-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveTransportadora}
                disabled={saving}
                className="px-7 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)] text-white font-bold text-sm shadow-cyan-500/15 transition-all active:scale-95 inline-flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Pencil size={16} />}
                Salvar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)]"
            >
              Fechar
            </button>
          )
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[var(--text-soft)] gap-2">
            <Loader2 className="animate-spin" size={18} />
            Carregando...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>
        ) : !active ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-soft)]">Proposta não encontrada.</div>
        ) : (
          <div>
            <div className="pt-2">
              <HorizontalScrollArea className="w-full overflow-x-auto">
                <div className="flex gap-2 pb-2">
                  {[
                    { id: 'producao', label: 'Produção', editable: false },
                    { id: 'transportadora', label: 'Transportadora', editable: true }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id as TabId)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        tab === t.id ? 'bg-[var(--primary-soft)] border-[var(--primary)]/40 text-[var(--primary)]' : 'bg-white/5 border-[var(--border)] text-[var(--text-soft)] hover:bg-white/10'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {t.editable ? <Pencil size={12} className={tab === t.id ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'} /> : null}
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </HorizontalScrollArea>
            </div>

            <div className="py-4">
              {tab === 'producao' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)]">Produção</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">Entrada de equipamento vinculada à proposta</div>
                      </div>
                      <button
                        type="button"
                        disabled={!canOpenEquipmentEntry}
                        onClick={() => setEquipmentEntryOpen(true)}
                        className={`shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.99] ${
                          canOpenEquipmentEntry
                            ? 'bg-[var(--primary)] hover:bg-[var(--primary)] text-white shadow-cyan-500/15'
                            : 'bg-white/5 border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
                        }`}
                      >
                        <Wrench size={16} />
                        Entrada de Equipamento
                      </button>
                    </div>
                  </div>
                  {String((equipmentInitialData as any)?.cod_proposta || '').trim() ? (
                    <EquipmentList codProposta={String((equipmentInitialData as any)?.cod_proposta || '').trim()} lastUpdate={equipmentLastUpdate} />
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-sm text-[var(--text-soft)]">
                      Salve a proposta para vincular equipamentos em produção.
                    </div>
                  )}
                </div>
              ) : tab === 'transportadora' ? (
                <div className="space-y-5">
                  {saveError ? (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{saveError}</div>
                  ) : null}

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)]">Transportadora</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">Dados de transporte e nota fiscal</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Remetente Completo</label>
                          <textarea
                            value={draftRemetenteCompleto}
                            onChange={(e) => setDraftRemetenteCompleto(e.target.value)}
                            rows={4}
                            placeholder="Informe o remetente completo..."
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all resize-y disabled:opacity-60"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Destinatário Completo</label>
                          <textarea
                            value={draftDestinatarioCompleto}
                            onChange={(e) => setDraftDestinatarioCompleto(e.target.value)}
                            rows={4}
                            placeholder="Informe o destinatário completo..."
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all resize-y disabled:opacity-60"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Nº da Nota Fiscal</label>
                          <input
                            value={draftNumeroNotaFiscal}
                            onChange={(e) => setDraftNumeroNotaFiscal(e.target.value)}
                            placeholder="Ex: 123456"
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all disabled:opacity-60"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Valor da Nota Fiscal</label>
                          <input
                            value={draftValorNotaFiscal}
                            onChange={(e) => setDraftValorNotaFiscal(e.target.value)}
                            inputMode="decimal"
                            placeholder="0,00"
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all font-mono disabled:opacity-60"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Transportadora</label>
                          <input
                            value={draftTransportadora}
                            onChange={(e) => setDraftTransportadora(e.target.value)}
                            placeholder="Nome da transportadora..."
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all disabled:opacity-60"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Material</label>
                          <input
                            value={draftMaterial}
                            onChange={(e) => setDraftMaterial(e.target.value)}
                            placeholder="Descrição do material..."
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all disabled:opacity-60"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Quantidade de Volumes</label>
                          <input
                            value={draftQuantidadeVolumes}
                            onChange={(e) => setDraftQuantidadeVolumes(e.target.value.replace(/[^\d]/g, ''))}
                            inputMode="numeric"
                            placeholder="0"
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all font-mono disabled:opacity-60"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Espécie (Caixa, Palete etc)</label>
                          <input
                            value={draftEspecie}
                            onChange={(e) => setDraftEspecie(e.target.value)}
                            placeholder="Ex: Caixa"
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all disabled:opacity-60"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Peso</label>
                          <input
                            value={draftPeso}
                            onChange={(e) => setDraftPeso(e.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all font-mono disabled:opacity-60"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)] ml-1">Medidas (AxCxL)</label>
                          <input
                            value={draftMedidas}
                            onChange={(e) => setDraftMedidas(e.target.value)}
                            placeholder="Ex: 10x20x30"
                            disabled={saving}
                            className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all font-mono disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <EquipmentEntryModal
        isOpen={equipmentEntryOpen}
        onClose={() => setEquipmentEntryOpen(false)}
        initialData={equipmentInitialData}
        onSuccess={() => setEquipmentLastUpdate(Date.now())}
      />
    </>
  )
}

