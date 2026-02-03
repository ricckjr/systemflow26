import React, { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AlertTriangle, Check, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { formatDateBR } from '@/utils/datetime'

export type CategoriaCompra =
  | 'Compra de Mercadoria para Revenda'
  | 'Compra de Materia Prima'
  | 'Material de Escritorio'

export type RequisicaoItemDraft = {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  precoUnitario: number
}

export type NovaRequisicaoPayload = {
  categoria: CategoriaCompra
  sugestaoEntrega: string
  codPropostaReferente?: string
  observacoes: string
  itens: RequisicaoItemDraft[]
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSave: (payload: NovaRequisicaoPayload) => void
}

type TabKey = 'itens' | 'observacoes'
type EditorMode = 'create' | 'edit'

function toMoney(n: number) {
  if (!Number.isFinite(n)) return '0,00'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ensureNumber(value: string) {
  const normalized = (value || '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export const NovaRequisicaoModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const inputBase =
    'w-full h-9 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors'
  const textareaBase =
    'w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors resize-none'

  const [tab, setTab] = useState<TabKey>('itens')
  const [categoria, setCategoria] = useState<CategoriaCompra>('Compra de Mercadoria para Revenda')
  const [sugestaoEntrega, setSugestaoEntrega] = useState<string>('')
  const [codPropostaReferente, setCodPropostaReferente] = useState<string>('')
  const [observacoes, setObservacoes] = useState<string>('')
  const [itens, setItens] = useState<RequisicaoItemDraft[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('create')
  const [editorOpen, setEditorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedItem = useMemo(
    () => itens.find((i) => i.id === selectedItemId) ?? null,
    [itens, selectedItemId]
  )

  const totalItens = useMemo(() => {
    return itens.reduce((sum, it) => sum + it.quantidade, 0)
  }, [itens])

  const totalValor = useMemo(() => {
    return itens.reduce((sum, it) => sum + it.quantidade * it.precoUnitario, 0)
  }, [itens])

  const editorTitle = editorMode === 'create' ? 'Novo Item' : 'Editar Item'

  const [draft, setDraft] = useState<RequisicaoItemDraft>({
    id: '',
    codigo: '',
    descricao: '',
    quantidade: 1,
    precoUnitario: 0,
  })

  const openNewItem = () => {
    setErrorMessage(null)
    setEditorMode('create')
    setDraft({
      id: `item_${crypto.randomUUID?.() ?? String(Date.now())}`,
      codigo: '',
      descricao: '',
      quantidade: 1,
      precoUnitario: 0,
    })
    setEditorOpen(true)
  }

  const openEditItem = () => {
    if (!selectedItem) return
    setErrorMessage(null)
    setEditorMode('edit')
    setDraft({ ...selectedItem })
    setEditorOpen(true)
  }

  const removeSelectedItem = () => {
    if (!selectedItemId) return
    setItens((prev) => prev.filter((it) => it.id !== selectedItemId))
    setSelectedItemId(null)
  }

  const saveItem = () => {
    if (!draft.descricao.trim()) {
      setErrorMessage('Informe a descrição do item.')
      return
    }
    if (!draft.quantidade || draft.quantidade <= 0) {
      setErrorMessage('Quantidade precisa ser maior que zero.')
      return
    }
    if (draft.precoUnitario < 0) {
      setErrorMessage('Preço unitário inválido.')
      return
    }

    setItens((prev) => {
      const exists = prev.some((it) => it.id === draft.id)
      if (!exists) return [draft, ...prev]
      return prev.map((it) => (it.id === draft.id ? draft : it))
    })
    setSelectedItemId(draft.id)
    setEditorOpen(false)
  }

  const handleSaveRequisicao = () => {
    setErrorMessage(null)

    if (!categoria) {
      setErrorMessage('Selecione a Categoria da Compra.')
      return
    }

    if (categoria === 'Compra de Mercadoria para Revenda' && !codPropostaReferente.trim()) {
      setErrorMessage('Informe o Cod da Proposta Referente.')
      return
    }

    onSave({
      categoria,
      sugestaoEntrega,
      codPropostaReferente: categoria === 'Compra de Mercadoria para Revenda' ? codPropostaReferente.trim() : undefined,
      observacoes,
      itens,
    })
    onClose()
  }

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors"
      >
        Fechar
      </button>
      <button
        type="button"
        onClick={handleSaveRequisicao}
        className="px-5 py-2 rounded-lg bg-[var(--primary)] text-white font-bold hover:brightness-110 transition-all flex items-center gap-2"
      >
        <Save size={16} />
        Salvar
      </button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      scrollableContent={false}
      title={
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Compras</div>
          <div className="text-base font-bold text-[var(--text-main)] truncate">Nova Requisição</div>
        </div>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-4 h-full">
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 min-h-0 flex-1">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4 min-h-0 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Categoria da Compra</label>
                <select
                  value={categoria}
                  onChange={(e) => {
                    const next = e.target.value as CategoriaCompra
                    setCategoria(next)
                    if (next !== 'Compra de Mercadoria para Revenda') setCodPropostaReferente('')
                  }}
                  className={inputBase}
                >
                  <option value="Compra de Mercadoria para Revenda">Compra de Mercadoria para Revenda</option>
                  <option value="Compra de Materia Prima">Compra de Materia Prima</option>
                  <option value="Material de Escritorio">Material de Escritorio</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Sugestão de Entrega</label>
                <input
                  type="date"
                  value={sugestaoEntrega}
                  onChange={(e) => setSugestaoEntrega(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>

            {categoria === 'Compra de Mercadoria para Revenda' && (
              <div className="mt-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Cod da Proposta Referente</label>
                  <input
                    value={codPropostaReferente}
                    onChange={(e) => setCodPropostaReferente(e.target.value)}
                    className={inputBase}
                    placeholder="Ex: 12345"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setTab('itens')}
                className={`px-3 py-2 text-[12px] font-bold transition-colors ${
                  tab === 'itens' ? 'text-cyan-300 border-b-2 border-cyan-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Itens da Requisição
              </button>
              <button
                type="button"
                onClick={() => setTab('observacoes')}
                className={`px-3 py-2 text-[12px] font-bold transition-colors ${
                  tab === 'observacoes'
                    ? 'text-cyan-300 border-b-2 border-cyan-500'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Observações
              </button>
            </div>

            {tab === 'itens' ? (
              <div className="mt-4 min-h-0 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={openNewItem}
                    className="h-9 px-3 rounded-lg bg-cyan-500/10 text-cyan-200 border border-cyan-500/20 hover:bg-cyan-500/15 transition inline-flex items-center gap-2 text-[12px] font-bold"
                  >
                    <Plus size={14} />
                    Novo Item
                  </button>
                  <button
                    type="button"
                    onClick={openEditItem}
                    disabled={!selectedItem}
                    className="h-9 px-3 rounded-lg bg-white/5 text-[var(--text-main)] border border-white/10 hover:bg-white/10 transition inline-flex items-center gap-2 text-[12px] font-bold disabled:opacity-40 disabled:hover:bg-white/5"
                  >
                    <Pencil size={14} />
                    Editar Item
                  </button>
                  <button
                    type="button"
                    onClick={removeSelectedItem}
                    disabled={!selectedItem}
                    className="h-9 px-3 rounded-lg bg-rose-500/10 text-rose-200 border border-rose-500/20 hover:bg-rose-500/15 transition inline-flex items-center gap-2 text-[12px] font-bold disabled:opacity-40 disabled:hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                    Excluir Item
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-main)] overflow-hidden flex flex-col min-h-0">
                  <div className="grid grid-cols-[90px_1fr_110px_130px_140px] gap-0 border-b border-[var(--border)] bg-[var(--bg-panel)]/60 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    <div className="px-3 py-2">Código</div>
                    <div className="px-3 py-2">Descrição</div>
                    <div className="px-3 py-2 text-right">Qtd</div>
                    <div className="px-3 py-2 text-right">Preço Unit.</div>
                    <div className="px-3 py-2 text-right">Valor Total</div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {itens.length === 0 ? (
                      <div className="p-4 text-[13px] text-[var(--text-muted)]">Nenhum item adicionado.</div>
                    ) : (
                      itens.map((it) => {
                        const active = it.id === selectedItemId
                        const total = it.quantidade * it.precoUnitario
                        return (
                          <button
                            type="button"
                            key={it.id}
                            onClick={() => setSelectedItemId(it.id)}
                            className={`w-full text-left grid grid-cols-[90px_1fr_110px_130px_140px] gap-0 px-0 border-b border-[var(--border)] last:border-b-0 hover:bg-white/5 transition ${
                              active ? 'bg-cyan-500/10' : ''
                            }`}
                          >
                            <div className="px-3 py-2 text-[12px] font-semibold text-[var(--text-main)] truncate">
                              {it.codigo || '-'}
                            </div>
                            <div className="px-3 py-2 text-[12px] text-[var(--text-main)] truncate">{it.descricao}</div>
                            <div className="px-3 py-2 text-[12px] text-[var(--text-main)] text-right tabular-nums">
                              {it.quantidade}
                            </div>
                            <div className="px-3 py-2 text-[12px] text-[var(--text-main)] text-right tabular-nums">
                              {toMoney(it.precoUnitario)}
                            </div>
                            <div className="px-3 py-2 text-[12px] text-[var(--text-main)] text-right tabular-nums">
                              {toMoney(total)}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 min-h-0 flex-1 flex flex-col">
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className={textareaBase}
                  rows={10}
                  placeholder="Digite observações da requisição..."
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4 min-h-0 flex flex-col">
            <div className="text-xs font-bold text-[var(--text-main)] mb-3">Resumo</div>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Categoria</span>
                <span className="text-[var(--text-main)] font-semibold text-right">{categoria}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Entrega</span>
                <span className="text-[var(--text-main)] font-semibold">
                  {sugestaoEntrega ? formatDateBR(sugestaoEntrega) : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Itens</span>
                <span className="text-[var(--text-main)] font-semibold tabular-nums">{itens.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Qtd total</span>
                <span className="text-[var(--text-main)] font-semibold tabular-nums">{totalItens}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Valor total</span>
                <span className="text-[var(--text-main)] font-semibold tabular-nums">R$ {toMoney(totalValor)}</span>
              </div>
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <div className="text-xs font-bold text-[var(--text-main)] mb-3">{editorTitle}</div>

              {editorOpen ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Código</label>
                    <input
                      value={draft.codigo}
                      onChange={(e) => setDraft((prev) => ({ ...prev, codigo: e.target.value }))}
                      className={inputBase}
                      placeholder="Ex: 001"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Descrição</label>
                    <input
                      value={draft.descricao}
                      onChange={(e) => setDraft((prev) => ({ ...prev, descricao: e.target.value }))}
                      className={inputBase}
                      placeholder="Ex: Papel A4"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Quantidade</label>
                      <input
                        value={String(draft.quantidade)}
                        onChange={(e) => setDraft((prev) => ({ ...prev, quantidade: Math.max(0, Math.floor(ensureNumber(e.target.value))) }))}
                        inputMode="numeric"
                        className={inputBase}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Preço Unit.</label>
                      <input
                        value={String(draft.precoUnitario).replace('.', ',')}
                        onChange={(e) => setDraft((prev) => ({ ...prev, precoUnitario: Math.max(0, ensureNumber(e.target.value)) }))}
                        inputMode="decimal"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--text-muted)]">Total do item</span>
                    <span className="text-[var(--text-main)] font-bold tabular-nums">
                      R$ {toMoney(draft.quantidade * draft.precoUnitario)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className="flex-1 h-9 px-3 rounded-lg border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors text-[12px] font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveItem}
                      className="flex-1 h-9 px-3 rounded-lg bg-cyan-500/10 text-cyan-200 border border-cyan-500/20 hover:bg-cyan-500/15 transition inline-flex items-center justify-center gap-2 text-[12px] font-bold"
                    >
                      <Check size={14} />
                      Salvar item
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-[var(--text-muted)]">
                  Selecione um item e clique em “Editar Item” ou clique em “Novo Item”.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
