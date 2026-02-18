import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Download, FilePlus, Loader2, Pencil, Plus, Search, Settings, Trash2, Upload } from 'lucide-react'
import { Modal } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import {
  createFinEmpresaCorrespondente,
  deleteFinEmpresaCorrespondente,
  fetchFinEmpresasCorrespondentes,
  FinEmpresaCorrespondente,
  getFinEmpresaCorrespondenteLogoUrl,
  updateFinEmpresaCorrespondente,
  uploadFinEmpresaCorrespondenteLogo
} from '@/services/financeiro'
import { supabase } from '@/services/supabase'

type EmpresaDocumento = {
  id: string
  nome: string
  arquivoNome?: string | null
  arquivoUrl?: string | null
  dataEmissao?: string | null
  dataVencimento?: string | null
  createdAt: string
}

const ALERTA_VENCIMENTO_DIAS = 30

function formatDateBR(dateISO: string) {
  if (!dateISO) return '-'
  const [y, m, d] = dateISO.split('-')
  if (!y || !m || !d) return dateISO
  return `${d}/${m}/${y}`
}

function getDiffDaysToVencimento(dataVencimento?: string | null) {
  const raw = String(dataVencimento || '').trim()
  if (!raw) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  let y: number | null = null
  let m: number | null = null
  let d: number | null = null
  const s = raw.includes('T') ? raw.slice(0, 10) : raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parts = s.split('-').map(Number)
    y = parts[0]
    m = parts[1]
    d = parts[2]
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const parts = s.split('/').map(Number)
    d = parts[0]
    m = parts[1]
    y = parts[2]
  }
  if (!y || !m || !d) return false
  const venc = new Date(y, m - 1, d)
  if (Number.isNaN(venc.getTime())) return false
  const diffTime = venc.getTime() - hoje.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

function isVencido(dataVencimento?: string | null) {
  const diffDays = getDiffDaysToVencimento(dataVencimento)
  if (diffDays === false) return false
  return diffDays < 0
}

function isVencendo(dataVencimento?: string | null) {
  const diffDays = getDiffDaysToVencimento(dataVencimento)
  if (diffDays === false) return false
  return diffDays >= 0 && diffDays <= ALERTA_VENCIMENTO_DIAS
}

type DocAlertStatus = 'vencido' | 'vencendo'

function getDocAlertStatus(dataVencimento?: string | null): DocAlertStatus | null {
  if (isVencido(dataVencimento)) return 'vencido'
  if (isVencendo(dataVencimento)) return 'vencendo'
  return null
}

function mergeDocAlertStatus(a: DocAlertStatus | null | undefined, b: DocAlertStatus | null | undefined): DocAlertStatus | null {
  if (a === 'vencido' || b === 'vencido') return 'vencido'
  if (a === 'vencendo' || b === 'vencendo') return 'vencendo'
  return null
}

const HeaderCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-5 shadow-sm">{children}</div>
)

const sb = supabase as any

export default function EmpresasCorrespondentes() {
  const { session, profile } = useAuth()
  const userId = (profile?.id || session?.user?.id || '').trim()

  const [items, setItems] = useState<FinEmpresaCorrespondente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDetalheOpen, setIsDetalheOpen] = useState(false)
  const [isDocumentoOpen, setIsDocumentoOpen] = useState(false)
  const [isDeleteDocOpen, setIsDeleteDocOpen] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = useMemo(() => items.find((i) => i.empresa_id === activeId) || null, [items, activeId])
  const detalheReturnIdRef = useRef<string | null>(null)
  const [docsByEmpresa, setDocsByEmpresa] = useState<Record<string, EmpresaDocumento[]>>({})
  const [docsLoaded, setDocsLoaded] = useState<Record<string, boolean>>({})
  const activeDocs = useMemo(() => (activeId ? docsByEmpresa[activeId] ?? [] : []), [docsByEmpresa, activeId])
  const [docsAlertaMap, setDocsAlertaMap] = useState<Record<string, DocAlertStatus>>({})

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [draftRazaoSocial, setDraftRazaoSocial] = useState('')
  const [draftNomeFantasia, setDraftNomeFantasia] = useState('')
  const [draftCnpj, setDraftCnpj] = useState('')
  const [draftIe, setDraftIe] = useState('')
  const [draftIm, setDraftIm] = useState('')
  const [draftEndereco, setDraftEndereco] = useState('')
  const [draftBairro, setDraftBairro] = useState('')
  const [draftCidade, setDraftCidade] = useState('')
  const [draftUf, setDraftUf] = useState('')
  const [draftCep, setDraftCep] = useState('')
  const [draftTelefone, setDraftTelefone] = useState('')

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const [docNome, setDocNome] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docEmissao, setDocEmissao] = useState('')
  const [docVencimento, setDocVencimento] = useState('')
  const [docError, setDocError] = useState<string | null>(null)
  const [savingDoc, setSavingDoc] = useState(false)
  const savingDocRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFinEmpresasCorrespondentes()
      setItems(data)
      try {
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        const limite = new Date(hoje)
        limite.setDate(limite.getDate() + ALERTA_VENCIMENTO_DIAS)
        const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`
        const { data: docsData, error: docsError } = await sb
          .from('fin_empresas_correspondentes_documentos')
          .select('empresa_id, data_vencimento')
          .lte('data_vencimento', limiteISO)
          .not('data_vencimento', 'is', null)

        if (docsError) throw docsError
        const map: Record<string, DocAlertStatus> = {}
        ;(docsData ?? []).forEach((row: any) => {
          const id = String(row?.empresa_id || '')
          if (!id) return
          const status = getDocAlertStatus(row?.data_vencimento)
          if (!status) return
          map[id] = mergeDocAlertStatus(map[id], status) as DocAlertStatus
        })
        setDocsAlertaMap(map)
      } catch (e) {
        setDocsAlertaMap({})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  useEffect(() => {
    if (!isFormOpen) return
    setError(null)
    if (active) {
      setDraftRazaoSocial(String(active.razao_social || '').trim())
      setDraftNomeFantasia(String(active.nome_fantasia || '').trim())
      setDraftCnpj(String(active.cnpj || '').trim())
      setDraftIe(String(active.inscricao_estadual || '').trim())
      setDraftIm(String(active.inscricao_municipal || '').trim())
      setDraftEndereco(String(active.endereco || '').trim())
      setDraftBairro(String(active.bairro || '').trim())
      setDraftCidade(String(active.cidade || '').trim())
      setDraftUf(String(active.uf || '').trim())
      setDraftCep(String(active.cep || '').trim())
      setDraftTelefone(String(active.telefone || '').trim())
      setLogoFile(null)
      setLogoPreview(getFinEmpresaCorrespondenteLogoUrl(active.logo_path))
      return
    }

    setDraftRazaoSocial('')
    setDraftNomeFantasia('')
    setDraftCnpj('')
    setDraftIe('')
    setDraftIm('')
    setDraftEndereco('')
    setDraftBairro('')
    setDraftCidade('')
    setDraftUf('')
    setDraftCep('')
    setDraftTelefone('')
    setLogoFile(null)
    setLogoPreview('')
  }, [isFormOpen, active])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((i) => {
      const hay = [
        i.codigo,
        i.nome_fantasia,
        i.razao_social,
        i.cnpj,
        i.telefone,
        i.cidade,
        i.uf
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ')
      return hay.includes(term)
    })
  }, [items, search])

  const openCreate = () => {
    setActiveId(null)
    setIsFormOpen(true)
  }

  const openEdit = (id: string) => {
    setActiveId(id)
    setIsFormOpen(true)
  }

  const openDetalhe = async (id: string) => {
    setActiveId(id)
    setIsDetalheOpen(true)
    try {
      if (docsLoaded[id]) return
      const { data, error } = await sb
        .from('fin_empresas_correspondentes_documentos')
        .select('id, nome, arquivo_nome, arquivo_url, data_emissao, data_vencimento, created_at')
        .eq('empresa_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      const docs: EmpresaDocumento[] = (data ?? []).map((d: any) => ({
        id: d.id,
        nome: d.nome,
        arquivoNome: d.arquivo_nome,
        arquivoUrl: d.arquivo_url,
        dataEmissao: d.data_emissao,
        dataVencimento: d.data_vencimento,
        createdAt: d.created_at
      }))
      setDocsByEmpresa((prev) => ({ ...prev, [id]: docs }))
      setDocsLoaded((prev) => ({ ...prev, [id]: true }))
    } catch (e) {
      console.error(e)
      setDocsByEmpresa((prev) => ({ ...prev, [id]: [] }))
      setDocsLoaded((prev) => ({ ...prev, [id]: true }))
    }
  }

  const openDocumento = () => {
    if (!activeId) return
    setDocNome('')
    setDocFile(null)
    setDocEmissao('')
    setDocVencimento('')
    setDocError(null)
    setSavingDoc(false)
    savingDocRef.current = false
    setIsDocumentoOpen(true)
    setIsDetalheOpen(false)
  }

  const askDelete = (id: string) => {
    setActiveId(id)
    setIsDeleteOpen(true)
  }

  const handlePickLogo = () => {
    logoInputRef.current?.click()
  }

  const handleLogoChange = (file: File) => {
    setLogoFile(file)
    setLogoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const handleSubmit = async () => {
    const nomeFantasia = draftNomeFantasia.trim()
    const razaoSocial = draftRazaoSocial.trim()
    if (!nomeFantasia && !razaoSocial) {
      setError('Informe pelo menos "Nome Fantasia" ou "Razão Social".')
      return
    }
    if (!userId) {
      setError('Sessão não encontrada. Faça login novamente.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const basePayload = {
        razao_social: razaoSocial ? razaoSocial : null,
        nome_fantasia: nomeFantasia ? nomeFantasia : null,
        cnpj: draftCnpj.trim() ? draftCnpj.trim() : null,
        inscricao_estadual: draftIe.trim() ? draftIe.trim() : null,
        inscricao_municipal: draftIm.trim() ? draftIm.trim() : null,
        endereco: draftEndereco.trim() ? draftEndereco.trim() : null,
        bairro: draftBairro.trim() ? draftBairro.trim() : null,
        cidade: draftCidade.trim() ? draftCidade.trim() : null,
        uf: draftUf.trim() ? draftUf.trim() : null,
        cep: draftCep.trim() ? draftCep.trim() : null,
        telefone: draftTelefone.trim() ? draftTelefone.trim() : null
      }

      let saved: FinEmpresaCorrespondente
      if (active) {
        saved = await updateFinEmpresaCorrespondente(active.empresa_id, basePayload)
      } else {
        saved = await createFinEmpresaCorrespondente(basePayload)
      }

      if (logoFile) {
        const uploaded = await uploadFinEmpresaCorrespondenteLogo({ file: logoFile, empresaId: saved.empresa_id, userId })
        saved = await updateFinEmpresaCorrespondente(saved.empresa_id, { logo_path: uploaded.path })
      }

      setIsFormOpen(false)
      const returnId = detalheReturnIdRef.current
      if (!returnId) setActiveId(null)
      setLogoFile(null)
      setLogoPreview('')
      await load()
      if (returnId) {
        detalheReturnIdRef.current = null
        setActiveId(saved.empresa_id)
        setIsDetalheOpen(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!activeId) return
    setDeleting(true)
    setError(null)
    try {
      await deleteFinEmpresaCorrespondente(activeId)
      setIsDeleteOpen(false)
      setActiveId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleAtivo = async (ativo: boolean) => {
    if (!active) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateFinEmpresaCorrespondente(active.empresa_id, { ativo })
      setItems((prev) => prev.map((it) => (it.empresa_id === updated.empresa_id ? updated : it)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao atualizar situação')
    } finally {
      setSaving(false)
    }
  }

  const askDeleteDocumento = (docId: string) => {
    setDeleteDocId(docId)
    setIsDeleteDocOpen(true)
  }

  const handleConfirmDeleteDocumento = async () => {
    if (!activeId) return
    const docId = deleteDocId
    if (!docId) return
    try {
      const { error } = await sb.from('fin_empresas_correspondentes_documentos').delete().eq('id', docId)
      if (error) throw error
      setDocsByEmpresa((prev) => {
        const nextDocs = (prev[activeId] ?? []).filter((d) => d.id !== docId)
        setDocsAlertaMap((prevMap) => {
          const status = nextDocs.reduce<DocAlertStatus | null>((acc, d) => mergeDocAlertStatus(acc, getDocAlertStatus(d.dataVencimento)), null)
          const next = { ...prevMap }
          if (status) next[activeId] = status
          else delete next[activeId]
          return next
        })
        return { ...prev, [activeId]: nextDocs }
      })
      setIsDeleteDocOpen(false)
      setDeleteDocId(null)
    } catch (e: any) {
      alert(e?.message || 'Erro ao excluir documento.')
    }
  }

  const handleSalvarDocumento = async () => {
    if (savingDocRef.current) return
    if (!activeId) return
    if (!userId) { setDocError('Sessão não encontrada. Faça login novamente.'); return }
    if (!docNome.trim()) { setDocError('Informe o nome do documento.'); return }
    if (!docFile) { setDocError('Selecione um arquivo.'); return }

    try {
      setSavingDoc(true)
      savingDocRef.current = true
      setDocError(null)

      const parts = String(docFile.name || '').split('.')
      const ext = parts.length > 1 ? parts[parts.length - 1] : ''
      const safeExt = ext ? `.${ext}` : ''
      const path = `fin-empresas-correspondentes-docs/${userId}/${activeId}/${Date.now()}_${Math.random().toString(36).slice(2)}${safeExt}`

      const { error: uploadError } = await supabase.storage.from('fin-empresas-correspondentes-docs').upload(path, docFile)
      if (uploadError) {
        const msg = String(uploadError?.message || '')
        if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not found')) {
          throw new Error("Bucket 'fin-empresas-correspondentes-docs' não existe. Aplique a migration 20260220_fin_empresas_correspondentes_documentos.sql.")
        }
        throw uploadError
      }

      const { data: pub } = supabase.storage.from('fin-empresas-correspondentes-docs').getPublicUrl(path)

      const { data: newDoc, error } = await sb
        .from('fin_empresas_correspondentes_documentos')
        .insert({
          empresa_id: activeId,
          nome: docNome.trim(),
          arquivo_nome: docFile.name,
          arquivo_url: pub.publicUrl,
          data_emissao: docEmissao || null,
          data_vencimento: docVencimento || null
        })
        .select()
        .single()

      if (error) throw error

      const mapped: EmpresaDocumento = {
        id: newDoc.id,
        nome: newDoc.nome,
        arquivoNome: newDoc.arquivo_nome,
        arquivoUrl: newDoc.arquivo_url,
        dataEmissao: newDoc.data_emissao,
        dataVencimento: newDoc.data_vencimento,
        createdAt: newDoc.created_at
      }

      setDocsByEmpresa((prev) => ({
        ...prev,
        [activeId]: [mapped, ...(prev[activeId] ?? [])]
      }))
      setDocsLoaded((prev) => ({ ...prev, [activeId]: true }))

      setIsDocumentoOpen(false)
      setIsDetalheOpen(true)
      setDocNome('')
      setDocFile(null)
      setDocEmissao('')
      setDocVencimento('')
      setDocError(null)
    } catch (e: any) {
      setDocError(e?.message || 'Erro ao salvar documento.')
    } finally {
      setSavingDoc(false)
      savingDocRef.current = false
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">Empresas Correspondentes</h1>
          <p className="text-sm text-slate-400 mt-1">Cadastre os dados e a logo usados na geração de propostas.</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
          <Settings size={14} className="text-cyan-400" />
          Financeiro
        </div>
      </div>

      <HeaderCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/15 transition-all active:scale-95"
          >
            <Plus size={16} />
            Nova Empresa
          </button>
        </div>
      </HeaderCard>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-slate-500" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm font-semibold text-slate-200">Nenhum registro encontrado</p>
          <p className="text-sm text-slate-400 mt-1">Crie o primeiro cadastro para começar.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
            <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Logo</div>
            <div className="col-span-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Nome Fantasia</div>
            <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Razão Social</div>
            <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400">CNPJ</div>
            <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</div>
          </div>
          <div className="divide-y divide-white/5">
            {filtered.map((i) => {
              const logoUrl = getFinEmpresaCorrespondenteLogoUrl(i.logo_path)
              const docAlert = i.ativo ? docsAlertaMap[i.empresa_id] ?? null : null
              return (
                <div
                  key={i.empresa_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetalhe(i.empresa_id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openDetalhe(i.empresa_id) }}
                  className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0B1220]/60 hover:bg-[#0B1220] transition-colors cursor-pointer"
                >
                  <div className="col-span-1 flex items-center">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-contain bg-white/5 border border-white/10" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10" />
                    )}
                  </div>
                  <div className="col-span-5 min-w-0">
                    <div className="text-sm text-slate-200 truncate flex items-center gap-2">
                      {docAlert ? (
                        <span title={docAlert === 'vencido' ? 'Documentos vencidos' : 'Documentos vencendo em breve'}>
                          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                        </span>
                      ) : null}
                      <span className="truncate">{i.nome_fantasia || '-'}</span>
                      {i.ativo ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 shrink-0">
                          Ativo
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20 shrink-0">
                          Desativado
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{[i.cidade, i.uf].filter(Boolean).join(' / ') || '-'}</div>
                  </div>
                  <div className="col-span-4 min-w-0">
                    <div className="text-sm text-slate-300 truncate">{i.razao_social || '-'}</div>
                    <div className="text-[11px] text-slate-400 truncate">{i.telefone || '-'}</div>
                  </div>
                  <div className="col-span-1 min-w-0">
                    <div className="text-[11px] text-slate-300 truncate">{i.cnpj || '-'}</div>
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(i.empresa_id) }}
                      className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); askDelete(i.empresa_id) }}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={isDetalheOpen}
        onClose={() => setIsDetalheOpen(false)}
        title={active ? `Empresa: ${active.nome_fantasia || active.razao_social || 'Empresa'}` : 'Empresa'}
        size="3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDetalheOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!activeId) return
                detalheReturnIdRef.current = activeId
                setIsDetalheOpen(false)
                openEdit(activeId)
              }}
              disabled={!active}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Editar Dados
            </button>
            {active?.ativo ? (
              <button
                type="button"
                onClick={() => handleToggleAtivo(false)}
                disabled={!active || saving}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Desativar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleAtivo(true)}
                disabled={!active || saving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Ativar
              </button>
            )}
            <button
              type="button"
              onClick={openDocumento}
              disabled={!active}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FilePlus size={16} />
              Adicionar Documento
            </button>
          </>
        }
      >
        {!active ? (
          <div className="text-sm text-slate-400">Selecione uma empresa.</div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {getFinEmpresaCorrespondenteLogoUrl(active.logo_path) ? (
                <img
                  src={getFinEmpresaCorrespondenteLogoUrl(active.logo_path)}
                  alt="Logo"
                  className="w-16 h-16 rounded-xl object-contain bg-white/5 border border-white/10"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10" />
              )}
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-white truncate">{active.nome_fantasia || active.razao_social || '—'}</div>
                <div className="text-sm text-slate-400 truncate">{active.codigo ? `Código: ${active.codigo}` : '—'}</div>
                <div className="mt-2">
                  {active.ativo ? (
                    <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[11px] font-bold uppercase tracking-wider border border-emerald-500/20">
                      Ativo
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 text-[11px] font-bold uppercase tracking-wider border border-rose-500/20">
                      Desativado
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-full">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Dados da Empresa</h4>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Razão Social</div>
                <div className="text-sm text-slate-200 mt-1">{active.razao_social || '—'}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">CNPJ</div>
                <div className="text-sm text-slate-200 mt-1">{active.cnpj || '—'}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Telefone</div>
                <div className="text-sm text-slate-200 mt-1">{active.telefone || '—'}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inscrição Estadual</div>
                <div className="text-sm text-slate-200 mt-1">{active.inscricao_estadual || '—'}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inscrição Municipal</div>
                <div className="text-sm text-slate-200 mt-1">{active.inscricao_municipal || '—'}</div>
              </div>
              <div className="col-span-full rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Endereço</div>
                <div className="text-sm text-slate-200 mt-1">
                  {[active.endereco, active.bairro, [active.cidade, active.uf].filter(Boolean).join(' - '), active.cep ? `CEP: ${active.cep}` : null]
                    .filter(Boolean)
                    .join(' • ') || '—'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-5 mt-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-200">Documentos</div>
                <div className="text-xs text-slate-500">{docsLoaded[active.empresa_id] ? activeDocs.length : '...'}</div>
              </div>
              {!docsLoaded[active.empresa_id] ? (
                <div className="mt-3 text-sm text-slate-500">Carregando documentos...</div>
              ) : activeDocs.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Nenhum documento adicionado.</div>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                  <table className="min-w-full text-left">
                    <thead className="bg-white/5">
                      <tr className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3 whitespace-nowrap">Emissão</th>
                        <th className="px-4 py-3 whitespace-nowrap">Vencimento</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-white/0">
                      {activeDocs.map((d) => {
                        const isAtivo = Boolean(active.ativo)
                        const vencido = isAtivo && isVencido(d.dataVencimento)
                        const vencendo = isAtivo && isVencendo(d.dataVencimento)
                        return (
                          <tr key={d.id} className={vencido ? 'bg-rose-500/5' : vencendo ? 'bg-amber-500/5' : ''}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {vencido ? (
                                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                ) : vencendo ? (
                                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                ) : null}
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-200 truncate">{d.nome}</div>
                                  {d.arquivoNome && <div className="text-xs text-slate-500 truncate">{d.arquivoNome}</div>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">{d.dataEmissao ? formatDateBR(d.dataEmissao) : '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">
                              <div className="flex items-center gap-2">
                                <span>{d.dataVencimento ? formatDateBR(d.dataVencimento) : '—'}</span>
                                {vencido ? (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20">
                                    Vencido
                                  </span>
                                ) : vencendo ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">
                                    Vence em breve
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                {d.arquivoUrl && (
                                  <a
                                    href={d.arquivoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors"
                                    title="Baixar Documento"
                                  >
                                    <Download size={16} />
                                  </a>
                                )}
                                <button
                                  onClick={() => askDeleteDocumento(d.id)}
                                  className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                                  title="Excluir Documento"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isDeleteDocOpen}
        onClose={() => { setIsDeleteDocOpen(false); setDeleteDocId(null) }}
        title="Excluir Documento"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setIsDeleteDocOpen(false); setDeleteDocId(null) }}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteDocumento}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
            >
              Excluir
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Tem certeza que deseja excluir este documento?</p>
          <p className="text-xs text-slate-500">Essa ação não pode ser desfeita.</p>
        </div>
      </Modal>

      <Modal
        isOpen={isDocumentoOpen}
        onClose={() => { setIsDocumentoOpen(false); setIsDetalheOpen(true) }}
        title="Adicionar Documento"
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setIsDocumentoOpen(false); setIsDetalheOpen(true) }}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarDocumento}
              disabled={savingDoc}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingDoc ? 'Salvando...' : 'Adicionar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {docError && <div className="text-rose-400 text-xs">{docError}</div>}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nome do Documento</label>
            <input
              value={docNome}
              onChange={(e) => setDocNome(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data de Emissão</label>
              <input
                type="date"
                value={docEmissao}
                onChange={(e) => setDocEmissao(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data de Vencimento</label>
              <input
                type="date"
                value={docVencimento}
                onChange={(e) => setDocVencimento(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Arquivo</label>
            <div className="relative group">
              <input
                type="file"
                id="empresa-doc-file-upload"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="empresa-doc-file-upload"
                className="flex items-center justify-center gap-2 w-full px-3 py-4 rounded-xl bg-[#0B1220] border border-dashed border-white/20 text-sm text-slate-400 cursor-pointer hover:border-cyan-500/50 hover:bg-white/5 transition-all"
              >
                <Upload size={16} />
                {docFile ? <span className="text-cyan-400 font-medium">{docFile.name}</span> : <span>Clique para selecionar um arquivo</span>}
              </label>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          if (saving) return
          const backId = detalheReturnIdRef.current
          setIsFormOpen(false)
          if (backId) {
            detalheReturnIdRef.current = null
            setActiveId(backId)
            setIsDetalheOpen(true)
            return
          }
          setActiveId(null)
        }}
        title={active ? `Editar Empresa (${active.nome_fantasia || active.razao_social || 'Empresa'})` : 'Nova Empresa'}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                const backId = detalheReturnIdRef.current
                setIsFormOpen(false)
                if (backId) {
                  detalheReturnIdRef.current = null
                  setActiveId(backId)
                  setIsDetalheOpen(true)
                  return
                }
                setActiveId(null)
              }}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Logo</div>
              <div className="mt-2 rounded-2xl border border-white/10 bg-[#0B1220] p-4">
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-xl object-contain bg-white/5 border border-white/10" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10" />
                  )}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handlePickLogo}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition-colors"
                    >
                      <Upload size={14} />
                      Enviar Logo
                    </button>
                    <div className="text-[11px] text-slate-400">JPG, PNG ou WEBP (máx. 3MB)</div>
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    handleLogoChange(f)
                  }}
                />
              </div>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Nome Fantasia</label>
                <input
                  value={draftNomeFantasia}
                  onChange={(e) => setDraftNomeFantasia(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Ex: Apliflow"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Razão Social</label>
                <input
                  value={draftRazaoSocial}
                  onChange={(e) => setDraftRazaoSocial(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Ex: APLIFLOW EQUIPAMENTOS INDUSTRIAIS LTDA"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">CNPJ</label>
                <input
                  value={draftCnpj}
                  onChange={(e) => setDraftCnpj(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Telefone</label>
                <input
                  value={draftTelefone}
                  onChange={(e) => setDraftTelefone(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Inscrição Estadual</label>
                <input
                  value={draftIe}
                  onChange={(e) => setDraftIe(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Inscrição Municipal</label>
                <input
                  value={draftIm}
                  onChange={(e) => setDraftIm(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Endereço</div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Endereço</label>
                <input
                  value={draftEndereco}
                  onChange={(e) => setDraftEndereco(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Rua, número, complemento"
                />
              </div>
              <div className="lg:col-span-4 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Bairro</label>
                <input
                  value={draftBairro}
                  onChange={(e) => setDraftBairro(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Bairro"
                />
              </div>
              <div className="lg:col-span-5 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Cidade</label>
                <input
                  value={draftCidade}
                  onChange={(e) => setDraftCidade(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Cidade"
                />
              </div>
              <div className="lg:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">UF</label>
                <input
                  value={draftUf}
                  onChange={(e) => setDraftUf(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="MG"
                />
              </div>
              <div className="lg:col-span-5 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">CEP</label>
                <input
                  value={draftCep}
                  onChange={(e) => setDraftCep(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="00000-000"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          if (deleting) return
          setIsDeleteOpen(false)
        }}
        title="Excluir Empresa"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleting}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-7 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Tem certeza que deseja excluir esta empresa?</p>
          <p className="text-sm text-slate-300">Essa ação não pode ser desfeita.</p>
        </div>
      </Modal>
    </div>
  )
}
