import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd'
import { Box, Plus } from 'lucide-react'
import { formatDateBR } from '@/utils/datetime'
import { NovaRequisicaoModal, NovaRequisicaoPayload } from '@/pages/ComprasEstoque/NovaRequisicaoModal'

type ColumnKey = 'requisicao' | 'pedido-compra' | 'aprovacao' | 'faturado'

type PurchaseCard = {
  id: string
  title: string
  createdAt: string
  categoria?: string
  sugestaoEntrega?: string
  codPropostaReferente?: string
  totalValor?: number
}

type Column = {
  key: ColumnKey
  title: string
  accentClass: string
  cardIds: string[]
}

const columnsOrder: ColumnKey[] = ['requisicao', 'pedido-compra', 'aprovacao', 'faturado']

const baseColumns: Record<ColumnKey, Omit<Column, 'cardIds'>> = {
  requisicao: { key: 'requisicao', title: 'Requisição', accentClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' },
  'pedido-compra': { key: 'pedido-compra', title: 'Pedido de Compra', accentClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200' },
  aprovacao: { key: 'aprovacao', title: 'Aprovação', accentClass: 'border-amber-500/30 bg-amber-500/10 text-amber-200' },
  faturado: { key: 'faturado', title: 'Faturado Pelo Fornecedor', accentClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' },
}

const initialCards: Record<string, PurchaseCard> = {
  'req-0001': { id: 'req-0001', title: 'REQ-0001', createdAt: new Date().toISOString() },
}

const initialColumns: Record<ColumnKey, Column> = {
  requisicao: { ...baseColumns.requisicao, cardIds: ['req-0001'] },
  'pedido-compra': { ...baseColumns['pedido-compra'], cardIds: [] },
  aprovacao: { ...baseColumns.aprovacao, cardIds: [] },
  faturado: { ...baseColumns.faturado, cardIds: [] },
}

function pad4(n: number) {
  return String(n).padStart(4, '0')
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

const ComprasKanban: React.FC = () => {
  const seq = useRef(2)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const hTrackRef = useRef<HTMLDivElement | null>(null)
  const hThumbRef = useRef<HTMLDivElement | null>(null)
  const hDragRef = useRef<{
    pointerId: number | null
    startX: number
    startScrollLeft: number
    maxThumbLeft: number
    maxScrollLeft: number
  }>({ pointerId: null, startX: 0, startScrollLeft: 0, maxThumbLeft: 0, maxScrollLeft: 0 })

  const [cardsById, setCardsById] = useState<Record<string, PurchaseCard>>(initialCards)
  const [columnsByKey, setColumnsByKey] = useState<Record<ColumnKey, Column>>(initialColumns)
  const [isNovaRequisicaoOpen, setIsNovaRequisicaoOpen] = useState(false)

  const totalCount = useMemo(() => Object.keys(cardsById).length, [cardsById])

  const updateHorizontalThumb = () => {
    const board = boardRef.current
    const track = hTrackRef.current
    const thumb = hThumbRef.current
    if (!board || !track || !thumb) return

    const trackWidth = track.clientWidth
    const scrollWidth = board.scrollWidth
    const clientWidth = board.clientWidth
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
    const visibleRatio = scrollWidth > 0 ? clientWidth / scrollWidth : 1
    const minThumbWidth = 56
    const thumbWidth = Math.max(24, Math.min(trackWidth, Math.round(Math.max(minThumbWidth, trackWidth * visibleRatio))))
    const maxThumbLeft = Math.max(0, trackWidth - thumbWidth)
    const thumbLeft = maxScrollLeft > 0 ? (board.scrollLeft / maxScrollLeft) * maxThumbLeft : 0

    thumb.style.width = `${thumbWidth}px`
    thumb.style.transform = `translateX(${thumbLeft}px)`

    hDragRef.current.maxThumbLeft = maxThumbLeft
    hDragRef.current.maxScrollLeft = maxScrollLeft
  }

  useEffect(() => {
    const board = boardRef.current
    if (!board) return

    const onWheel = (e: WheelEvent) => {
      const el = boardRef.current
      if (!el) return
      e.preventDefault()
      const primaryDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      el.scrollLeft += primaryDelta
    }

    const onScroll = () => updateHorizontalThumb()
    const onResize = () => updateHorizontalThumb()

    board.addEventListener('wheel', onWheel, { passive: false })
    board.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    updateHorizontalThumb()

    return () => {
      board.removeEventListener('wheel', onWheel as any)
      board.removeEventListener('scroll', onScroll as any)
      window.removeEventListener('resize', onResize as any)
    }
  }, [])

  const onHorizontalTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const board = boardRef.current
    const track = hTrackRef.current
    const thumb = hThumbRef.current
    if (!board || !track || !thumb) return

    track.setPointerCapture(e.pointerId)

    const trackRect = track.getBoundingClientRect()
    const thumbRect = thumb.getBoundingClientRect()
    const clickX = e.clientX - trackRect.left
    const thumbWidth = thumbRect.width
    const maxThumbLeft = hDragRef.current.maxThumbLeft
    const maxScrollLeft = hDragRef.current.maxScrollLeft

    const isThumbTarget = (e.target as HTMLElement | null) === thumb
    if (!isThumbTarget && maxThumbLeft > 0 && maxScrollLeft > 0) {
      const nextThumbLeft = clamp(clickX - thumbWidth / 2, 0, maxThumbLeft)
      const nextScrollLeft = (nextThumbLeft / maxThumbLeft) * maxScrollLeft
      board.scrollLeft = nextScrollLeft
    }

    hDragRef.current.pointerId = e.pointerId
    hDragRef.current.startX = e.clientX
    hDragRef.current.startScrollLeft = board.scrollLeft
  }

  const onHorizontalTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const board = boardRef.current
    const drag = hDragRef.current
    if (!board) return
    if (drag.pointerId !== e.pointerId) return

    const maxThumbLeft = drag.maxThumbLeft
    const maxScrollLeft = drag.maxScrollLeft
    if (maxThumbLeft <= 0 || maxScrollLeft <= 0) return

    const dx = e.clientX - drag.startX
    const scrollPerPx = maxScrollLeft / maxThumbLeft
    board.scrollLeft = clamp(drag.startScrollLeft + dx * scrollPerPx, 0, maxScrollLeft)
  }

  const onHorizontalTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = hDragRef.current
    if (drag.pointerId !== e.pointerId) return
    drag.pointerId = null
  }

  const handleSaveNovaRequisicao = (payload: NovaRequisicaoPayload) => {
    const num = seq.current++
    const id = `req-${pad4(num)}`
    const title = `REQ-${pad4(num)}`

    setCardsById((prev) => ({
      ...prev,
      [id]: {
        id,
        title,
        createdAt: new Date().toISOString(),
        categoria: payload.categoria,
        sugestaoEntrega: payload.sugestaoEntrega || '',
        codPropostaReferente: payload.codPropostaReferente || '',
        totalValor: payload.itens.reduce((sum, it) => sum + it.quantidade * it.precoUnitario, 0),
      },
    }))

    setColumnsByKey((prev) => ({
      ...prev,
      requisicao: { ...prev.requisicao, cardIds: [id, ...prev.requisicao.cardIds] },
    }))
  }

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const fromKey = source.droppableId as ColumnKey
    const toKey = destination.droppableId as ColumnKey

    setColumnsByKey((prev) => {
      const from = prev[fromKey]
      const to = prev[toKey]
      if (!from || !to) return prev

      const nextFromIds = [...from.cardIds]
      nextFromIds.splice(source.index, 1)

      const nextToIds = fromKey === toKey ? nextFromIds : [...to.cardIds]
      nextToIds.splice(destination.index, 0, draggableId)

      return {
        ...prev,
        [fromKey]: { ...from, cardIds: nextFromIds },
        [toKey]: fromKey === toKey ? { ...to, cardIds: nextToIds } : { ...to, cardIds: nextToIds },
      }
    })
  }

  return (
    <div className="pt-4 pb-6 max-w-[1600px] mx-auto px-4 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
            <Box size={14} />
            Compras e Estoque · Compras
          </div>
          <h1 className="mt-2 text-[15px] font-semibold text-[var(--text)]">Compras</h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            Kanban de compras ({totalCount} {totalCount === 1 ? 'item' : 'itens'}).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsNovaRequisicaoOpen(true)}
          className="h-10 px-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15 transition inline-flex items-center gap-2 text-[13px] font-semibold"
        >
          <Plus size={16} />
          Nova Requisição
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 md:p-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="relative">
            <div
              ref={boardRef}
              className="kanban-hide-native-scrollbar overflow-x-scroll overflow-y-hidden pr-2 pb-6 rounded-2xl"
              style={{ scrollbarGutter: 'stable', height: 'calc(100vh - 320px)' }}
            >
              <div className="flex h-full items-start gap-4 min-w-fit">
                {columnsOrder.map((key) => {
                  const col = columnsByKey[key]
                  const count = col.cardIds.length
                  return (
                    <div key={col.key} className="flex flex-col w-80 h-full shrink-0">
                      <div className="mb-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-body)]/40 px-4 py-3">
                        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-bold ${col.accentClass}`}>
                          <span>{col.title}</span>
                          <span className="opacity-80">·</span>
                          <span className="opacity-90">{count}</span>
                        </div>
                      </div>

                      <Droppable droppableId={col.key}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 rounded-2xl border bg-[var(--bg-body)]/40 ${
                              snapshot.isDraggingOver ? 'border-cyan-500/30 ring-1 ring-cyan-500/20' : 'border-[var(--border)]'
                            }`}
                          >
                            <div className="h-full overflow-y-scroll px-3 py-3 space-y-2" style={{ overscrollBehavior: 'contain' }}>
                              {col.cardIds.map((id, index) => {
                                const card = cardsById[id]
                                if (!card) return null
                                const subtitleLeft = card.categoria ? card.categoria : 'Requisição'
                                const subtitleRight = card.sugestaoEntrega ? formatDateBR(card.sugestaoEntrega) : ''
                                const chip = card.codPropostaReferente ? `PROP ${card.codPropostaReferente}` : ''
                                return (
                                  <Draggable key={card.id} draggableId={card.id} index={index}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className={`rounded-xl border p-3 bg-[#0F172A] border-white/10 hover:border-white/20 hover:bg-[#0B1220] transition ${
                                          dragSnapshot.isDragging ? 'ring-2 ring-cyan-500 rotate-2 scale-[1.02] shadow-2xl z-50' : ''
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="text-[13px] font-semibold text-slate-100 truncate">{card.title}</div>
                                            <div className="mt-1 text-[12px] text-slate-400 flex items-center gap-2">
                                              <span className="truncate">{subtitleLeft}</span>
                                              {subtitleRight && <span className="text-slate-600">·</span>}
                                              {subtitleRight && <span className="shrink-0">{subtitleRight}</span>}
                                            </div>
                                          </div>
                                          <div className="text-[10px] font-bold text-slate-500 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                                            #{card.id.slice(-4)}
                                          </div>
                                        </div>
                                        {chip && (
                                          <div className="mt-3">
                                            <span className="inline-flex items-center px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-[10px] font-bold text-slate-200">
                                              {chip}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                )
                              })}
                              {provided.placeholder}

                              {count === 0 && (
                                <div className="rounded-xl border border-dashed border-white/10 p-3 text-[12px] text-slate-500">
                                  Solte itens aqui.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )
                })}
              </div>
            </div>

            <div
              ref={hTrackRef}
              onPointerDown={onHorizontalTrackPointerDown}
              onPointerMove={onHorizontalTrackPointerMove}
              onPointerUp={onHorizontalTrackPointerUp}
              className="mt-3 h-3 rounded-full border border-white/10 bg-white/5 relative select-none"
            >
              <div
                ref={hThumbRef}
                className="h-full rounded-full bg-slate-200/20 hover:bg-slate-200/25 border border-white/10 shadow-sm cursor-grab active:cursor-grabbing"
              />
            </div>
          </div>
        </DragDropContext>
      </div>

      <NovaRequisicaoModal
        isOpen={isNovaRequisicaoOpen}
        onClose={() => setIsNovaRequisicaoOpen(false)}
        onSave={handleSaveNovaRequisicao}
      />
    </div>
  )
}

export default ComprasKanban
