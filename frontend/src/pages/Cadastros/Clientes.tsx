import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, Plus, Search, Pencil, ArrowRightLeft, History, Loader2, Building2, User, Mail, Phone, MapPin, BadgeCheck, Globe2, Tags, UserPlus, Briefcase, AtSign } from 'lucide-react'
import { Modal } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { Cliente, ClienteRegimeTributario, ClienteTipoPessoa, createCliente, fetchClientes, updateCliente } from '@/services/clientes'
import { fetchCrmOrigensLead, fetchCrmVerticais, fetchOportunidadesByClienteId } from '@/services/crm'
import { ClienteContato, createClienteContato, fetchClienteContatos, updateClienteContato } from '@/services/clienteContatos'
import { useUsuarios } from '@/hooks/useUsuarios'

export default function Clientes() {
  const { session, profile } = useAuth()
  const userId = session?.user?.id || ''
  const isAdmin = profile?.cargo === 'ADMIN'
  const { usuarios, loading: usuariosLoading } = useUsuarios()
  const [items, setItems] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = useMemo(() => items.find(i => i.cliente_id === activeId) || null, [items, activeId])

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [transferUserId, setTransferUserId] = useState<string>('')
  const [transferring, setTransferring] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyContatos, setHistoryContatos] = useState<ClienteContato[]>([])
  const [historyOportunidades, setHistoryOportunidades] = useState<any[]>([])

  const [origensLead, setOrigensLead] = useState<{ id: string; label: string }[]>([])
  const [verticais, setVerticais] = useState<{ id: string; label: string }[]>([])

  const [contatos, setContatos] = useState<ClienteContato[]>([])
  const [contatosLoading, setContatosLoading] = useState(false)
  const [isContatoOpen, setIsContatoOpen] = useState(false)
  const [contatoActiveId, setContatoActiveId] = useState<string | null>(null)
  const [contatoSaving, setContatoSaving] = useState(false)
  const [contatoError, setContatoError] = useState<string | null>(null)

  const [draft, setDraft] = useState(() => ({
    cliente_nome_razao_social: '',
    cliente_nome_fantasia: '',
    cliente_documento: '',
    cliente_tipo_pessoa: 'JURIDICA' as ClienteTipoPessoa,
    cliente_vertical: '',
    cliente_email: '',
    cliente_telefone: '',
    cliente_cep: '',
    cliente_endereco: '',
    cliente_numero: '',
    cliente_complemento: '',
    cliente_bairro: '',
    cliente_cidade: '',
    cliente_uf: '',
    cliente_pais: 'BR',
    cliente_inscricao_estadual: '',
    cliente_inscricao_municipal: '',
    cliente_optante_simples_nacional: false,
    cliente_regime_tributario: '' as '' | ClienteRegimeTributario,
    cliente_website: '',
    cliente_instagram: '',
    cliente_facebook: '',
    cliente_linkedin: '',
    cliente_origem_lead: '',
    cliente_tags: ['CLIENTE'] as string[],
    cliente_observacoes: '',
    user_id: '' as string
  }))

  const [contatoDraft, setContatoDraft] = useState(() => ({
    integ_id: '',
    contato_nome: '',
    contato_cargo: '',
    contato_telefone01: '',
    contato_telefone02: '',
    contato_email: '',
    contato_obs: ''
  }))

  const normalizeDigits = (v: string) => (v || '').replace(/\D/g, '')
  const initials = (nome: string) => {
    const parts = (nome || '').trim().split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] || ''
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''
    return (first + last).toUpperCase() || '?'
  }

  const validateDraft = () => {
    const nome = draft.cliente_nome_razao_social.trim()
    if (!nome) return 'Nome/Razão Social é obrigatório.'
    const docDigits = normalizeDigits(draft.cliente_documento)
    if (!docDigits) return 'Documento (CPF/CNPJ) é obrigatório.'
    if (docDigits.length !== 11 && docDigits.length !== 14) return 'Documento inválido: precisa ter 11 (CPF) ou 14 (CNPJ) dígitos.'
    if (!userId) return 'Sessão não encontrada. Faça login novamente.'
    return null
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchClientes({ search: search.trim() })
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar clientes.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const loadContatos = useCallback(async (clienteId: string) => {
    setContatosLoading(true)
    try {
      const data = await fetchClienteContatos(clienteId)
      setContatos(data)
    } finally {
      setContatosLoading(false)
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        const [origens, verts] = await Promise.all([fetchCrmOrigensLead(), fetchCrmVerticais()])
        setOrigensLead(
          origens.map(o => ({
            id: (o as any).orig_id,
            label: (o as any).descricao_orig
          }))
        )
        setVerticais(
          verts.map(v => ({
            id: (v as any).vert_id,
            label: (v as any).descricao_vert
          }))
        )
      } catch {
        setOrigensLead([])
        setVerticais([])
      }
    }
    run()
  }, [])

  useEffect(() => {
    if (!isFormOpen) return
    if (!draft.cliente_origem_lead) return
    if (origensLead.some(o => o.label === draft.cliente_origem_lead)) return
    setDraft(prev => ({ ...prev, cliente_origem_lead: '' }))
  }, [draft.cliente_origem_lead, isFormOpen, origensLead])

  useEffect(() => {
    if (!isFormOpen) return
    setError(null)
    if (active) {
      setDraft({
        cliente_nome_razao_social: active.cliente_nome_razao_social || '',
        cliente_nome_fantasia: active.cliente_nome_fantasia || '',
        cliente_documento: active.cliente_documento_formatado || active.cliente_documento || '',
        cliente_tipo_pessoa: active.cliente_tipo_pessoa,
        cliente_vertical: active.cliente_vertical || '',
        cliente_email: active.cliente_email || '',
        cliente_telefone: active.cliente_telefone || '',
        cliente_cep: active.cliente_cep || '',
        cliente_endereco: active.cliente_endereco || '',
        cliente_numero: active.cliente_numero || '',
        cliente_complemento: active.cliente_complemento || '',
        cliente_bairro: active.cliente_bairro || '',
        cliente_cidade: active.cliente_cidade || '',
        cliente_uf: active.cliente_uf || '',
        cliente_pais: active.cliente_pais || 'BR',
        cliente_inscricao_estadual: active.cliente_inscricao_estadual || '',
        cliente_inscricao_municipal: active.cliente_inscricao_municipal || '',
        cliente_optante_simples_nacional: !!active.cliente_optante_simples_nacional,
        cliente_regime_tributario: (active.cliente_regime_tributario || '') as any,
        cliente_website: active.cliente_website || '',
        cliente_instagram: active.cliente_instagram || '',
        cliente_facebook: active.cliente_facebook || '',
        cliente_linkedin: active.cliente_linkedin || '',
        cliente_origem_lead: active.cliente_origem_lead || '',
        cliente_tags: (active.cliente_tags || ['CLIENTE']) as any,
        cliente_observacoes: active.cliente_observacoes || '',
        user_id: active.user_id || userId
      })
      return
    }
    setDraft(d => ({
      ...d,
      cliente_nome_razao_social: '',
      cliente_nome_fantasia: '',
      cliente_documento: '',
      cliente_email: '',
      cliente_telefone: '',
      cliente_observacoes: '',
      user_id: userId
    }))
  }, [isFormOpen, active])

  useEffect(() => {
    if (!isFormOpen) return
    setContatoError(null)
    setIsContatoOpen(false)
    setContatoActiveId(null)
    setContatoDraft({
      integ_id: '',
      contato_nome: '',
      contato_cargo: '',
      contato_telefone01: '',
      contato_telefone02: '',
      contato_email: '',
      contato_obs: ''
    })

    if (!activeId) {
      setContatos([])
      return
    }
    loadContatos(activeId)
  }, [isFormOpen, activeId, loadContatos])

  const headerStats = useMemo(() => {
    const total = items.length
    const fornecedores = items.filter(i => (i.cliente_tags || []).includes('FORNECEDOR')).length
    return { total, fornecedores }
  }, [items])

  const openCreate = () => {
    setActiveId(null)
    setIsFormOpen(true)
  }

  const openEdit = (id: string) => {
    setActiveId(id)
    setIsFormOpen(true)
  }

  const openTransfer = (id: string) => {
    setActiveId(id)
    const current = items.find(i => i.cliente_id === id) || null
    setTransferUserId(current?.user_id || '')
    setIsTransferOpen(true)
  }

  const openHistory = async (id: string) => {
    setActiveId(id)
    setIsHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const [contatosData, oportunidadesData] = await Promise.all([
        fetchClienteContatos(id),
        fetchOportunidadesByClienteId(id)
      ])
      setHistoryContatos(contatosData)
      setHistoryOportunidades(oportunidadesData as any[])
    } finally {
      setHistoryLoading(false)
    }
  }

  const onSave = async () => {
    const v = validateDraft()
    if (v) {
      setError(v)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const docDigits = normalizeDigits(draft.cliente_documento)
      const inferredTipo = (docDigits.length === 11 ? 'FISICA' : 'JURIDICA') as ClienteTipoPessoa
      const payloadBase = {
        cliente_nome_razao_social: draft.cliente_nome_razao_social.trim(),
        cliente_nome_fantasia: draft.cliente_nome_fantasia.trim() || null,
        cliente_documento: docDigits || null,
        cliente_tipo_pessoa: inferredTipo,
        cliente_vertical: draft.cliente_vertical.trim() || null,
        cliente_email: draft.cliente_email.trim() || null,
        cliente_telefone: draft.cliente_telefone.trim() || null,
        cliente_cep: draft.cliente_cep.trim() || null,
        cliente_endereco: draft.cliente_endereco.trim() || null,
        cliente_numero: draft.cliente_numero.trim() || null,
        cliente_complemento: draft.cliente_complemento.trim() || null,
        cliente_bairro: draft.cliente_bairro.trim() || null,
        cliente_cidade: draft.cliente_cidade.trim() || null,
        cliente_uf: draft.cliente_uf.trim().toUpperCase() || null,
        cliente_pais: draft.cliente_pais.trim().toUpperCase() || 'BR',
        cliente_inscricao_estadual: draft.cliente_inscricao_estadual.trim() || null,
        cliente_inscricao_municipal: draft.cliente_inscricao_municipal.trim() || null,
        cliente_optante_simples_nacional: !!draft.cliente_optante_simples_nacional,
        cliente_regime_tributario: (draft.cliente_regime_tributario || null) as any,
        cliente_website: draft.cliente_website.trim() || null,
        cliente_instagram: draft.cliente_instagram.trim() || null,
        cliente_facebook: draft.cliente_facebook.trim() || null,
        cliente_linkedin: draft.cliente_linkedin.trim() || null,
        cliente_origem_lead: draft.cliente_origem_lead.trim() || null,
        cliente_tags: Array.from(new Set((draft.cliente_tags || []).filter(Boolean))),
        cliente_observacoes: draft.cliente_observacoes.trim() || null,
        ...(isAdmin ? { user_id: draft.user_id || null } : {})
      }

      if (activeId) {
        await updateCliente(activeId, payloadBase)
      } else {
        await createCliente(payloadBase as any)
      }
      setIsFormOpen(false)
      setActiveId(null)
      await load()
    } catch (e) {
      const err = e as any
      if (err?.code === '23505') {
        setError('Documento já cadastrado. Use outro documento ou edite o cliente existente.')
      } else {
        setError(e instanceof Error ? e.message : 'Falha ao salvar cliente.')
      }
    } finally {
      setSaving(false)
    }
  }

  const onTransfer = async () => {
    if (!activeId) return
    if (!transferUserId) {
      setError('Selecione um vendedor para transferir.')
      return
    }
    setTransferring(true)
    setError(null)
    try {
      await updateCliente(activeId, { user_id: transferUserId })
      setIsTransferOpen(false)
      setActiveId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao transferir cliente.')
    } finally {
      setTransferring(false)
    }
  }

  const openContatoCreate = () => {
    if (!activeId) return
    setContatoError(null)
    setContatoActiveId(null)
    setContatoDraft({
      integ_id: '',
      contato_nome: '',
      contato_cargo: '',
      contato_telefone01: '',
      contato_telefone02: '',
      contato_email: '',
      contato_obs: ''
    })
    setIsContatoOpen(true)
  }

  const openContatoEdit = (contatoId: string) => {
    const c = contatos.find(x => x.contato_id === contatoId)
    if (!c) return
    setContatoError(null)
    setContatoActiveId(contatoId)
    setContatoDraft({
      integ_id: c.integ_id || '',
      contato_nome: c.contato_nome || '',
      contato_cargo: c.contato_cargo || '',
      contato_telefone01: c.contato_telefone01 || '',
      contato_telefone02: c.contato_telefone02 || '',
      contato_email: c.contato_email || '',
      contato_obs: c.contato_obs || ''
    })
    setIsContatoOpen(true)
  }

  const validateContato = () => {
    if (!activeId) return 'Salve o cliente antes de adicionar contatos.'
    if (!contatoDraft.contato_nome.trim()) return 'Nome do contato é obrigatório.'
    if (contatoDraft.contato_email.trim() && !/^\S+@\S+\.\S+$/.test(contatoDraft.contato_email.trim())) return 'Email do contato inválido.'
    if (!userId) return 'Sessão não encontrada. Faça login novamente.'
    return null
  }

  const onSaveContato = async () => {
    const v = validateContato()
    if (v) {
      setContatoError(v)
      return
    }
    if (!activeId) return
    setContatoSaving(true)
    setContatoError(null)
    try {
      const payloadBase = {
        integ_id: contatoDraft.integ_id.trim() || null,
        contato_nome: contatoDraft.contato_nome.trim(),
        contato_cargo: contatoDraft.contato_cargo.trim() || null,
        contato_telefone01: contatoDraft.contato_telefone01.trim() || null,
        contato_telefone02: contatoDraft.contato_telefone02.trim() || null,
        contato_email: contatoDraft.contato_email.trim() || null,
        contato_obs: contatoDraft.contato_obs.trim() || null
      }

      if (contatoActiveId) {
        await updateClienteContato(contatoActiveId, payloadBase)
      } else {
        await createClienteContato({
          ...payloadBase,
          cliente_id: activeId,
          user_id: userId
        } as any)
      }
      setIsContatoOpen(false)
      setContatoActiveId(null)
      await loadContatos(activeId)
    } catch (e) {
      setContatoError(e instanceof Error ? e.message : 'Falha ao salvar contato.')
    } finally {
      setContatoSaving(false)
    }
  }

  const toggleTag = (tag: string) => {
    setDraft(prev => {
      const set = new Set(prev.cliente_tags || [])
      if (set.has(tag)) set.delete(tag)
      else set.add(tag)
      const arr = Array.from(set)
      return { ...prev, cliente_tags: arr.length ? arr : ['CLIENTE'] }
    })
  }

  const regimeOptions: { value: ClienteRegimeTributario; label: string }[] = [
    { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
    { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
    { value: 'LUCRO_REAL', label: 'Lucro Real' }
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">Clientes</h1>
          <p className="text-sm text-slate-400 mt-1">Gestão de clientes e dados cadastrais (CRM + Fiscal + Integração).</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
          <Users size={14} className="text-cyan-400" />
          Cadastros
        </div>
      </div>

      <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Building2 size={18} className="text-cyan-300" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">Base de Clientes</div>
              <div className="text-xs text-slate-400">
                Total: <span className="text-slate-200 font-semibold">{headerStats.total}</span> · Fornecedores:{' '}
                <span className="text-slate-200 font-semibold">{headerStats.fornecedores}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group w-full md:w-[320px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, documento, email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
              />
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/15 transition-all active:scale-95"
            >
              <Plus size={16} />
              Novo Cliente
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-slate-500" size={28} />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
              <p className="text-sm font-semibold text-slate-200">Nenhum cliente encontrado</p>
              <p className="text-sm text-slate-400 mt-1">Crie o primeiro cadastro para começar.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/5">
              <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
                <div className="col-span-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</div>
                <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Documento</div>
                <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Vendedor</div>
                <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</div>
              </div>
              <div className="divide-y divide-white/5">
                {items.map(i => {
                  const vendedor = usuarios.find(u => u.id === i.user_id) || null
                  const isFornecedor = (i.cliente_tags || []).includes('FORNECEDOR')
                  return (
                    <div key={i.cliente_id} className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0B1220]/60 hover:bg-[#0B1220] transition-colors">
                      <div className="col-span-6 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                            isFornecedor ? 'bg-amber-500/10 border-amber-500/20' : 'bg-cyan-500/10 border-cyan-500/20'
                          }`}
                        >
                          {isFornecedor ? (
                            <Building2 size={14} className="text-amber-300" />
                          ) : (
                            <User size={14} className="text-cyan-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-200 truncate" title={i.cliente_nome_razao_social}>
                            {i.cliente_nome_razao_social}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            {(i.cliente_tags || []).slice(0, 2).map(t => (
                              <span key={t} className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-300">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <div className="text-sm text-slate-200 font-mono truncate">{i.cliente_documento_formatado || i.cliente_documento || '-'}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{i.cliente_tipo_pessoa === 'FISICA' ? 'CPF' : 'CNPJ'}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      {vendedor ? (
                        <div className="flex items-center gap-2 min-w-0">
                          {vendedor.avatar_url ? (
                            <img
                              src={vendedor.avatar_url}
                              alt={vendedor.nome}
                              className="w-8 h-8 rounded-full object-cover border border-white/10"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-slate-200">
                              {initials(vendedor.nome)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm text-slate-200 truncate">{vendedor.nome}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate">{vendedor.cargo || ''}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">-</div>
                      )}
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(i.cliente_id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openHistory(i.cliente_id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
                        title="Histórico"
                      >
                        <History size={14} />
                      </button>
                      {(isAdmin || i.user_id === userId) && (
                        <button
                          type="button"
                          onClick={() => openTransfer(i.cliente_id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-colors"
                          title="Transferir para vendedor"
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                      )}
                    </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          if (saving) return
          setIsFormOpen(false)
          setActiveId(null)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <BadgeCheck size={18} className="text-cyan-300" />
            </div>
            {activeId ? 'Editar Cliente' : 'Novo Cliente'}
          </div>
        }
        size="full"
      >
        <div className="space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1 flex items-center gap-2">
                <Building2 size={12} className="text-slate-500" />
                Nome/Razão Social
              </label>
              <input
                value={draft.cliente_nome_razao_social}
                onChange={e => setDraft(prev => ({ ...prev, cliente_nome_razao_social: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="Ex: Empresa XYZ LTDA"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {isAdmin && (
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Vendedor</label>
                <select
                  value={draft.user_id}
                  onChange={e => setDraft(prev => ({ ...prev, user_id: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  disabled={usuariosLoading}
                >
                  <option value="" disabled>
                    {usuariosLoading ? 'Carregando...' : 'Selecione'}
                  </option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Nome Fantasia</label>
              <input
                value={draft.cliente_nome_fantasia}
                onChange={e => setDraft(prev => ({ ...prev, cliente_nome_fantasia: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="Ex: XYZ"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Tipo Pessoa</label>
              <select
                value={draft.cliente_tipo_pessoa}
                onChange={e => setDraft(prev => ({ ...prev, cliente_tipo_pessoa: e.target.value as any }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="JURIDICA">Jurídica</option>
                <option value="FISICA">Física</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Documento</label>
              <input
                value={draft.cliente_documento}
                onChange={e =>
                  setDraft(prev => {
                    const nextValue = e.target.value
                    const digits = normalizeDigits(nextValue)
                    const nextTipo =
                      digits.length === 11 ? ('FISICA' as ClienteTipoPessoa) : digits.length === 14 ? ('JURIDICA' as ClienteTipoPessoa) : prev.cliente_tipo_pessoa
                    return { ...prev, cliente_documento: nextValue, cliente_tipo_pessoa: nextTipo }
                  })
                }
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                placeholder="CPF (11) ou CNPJ (14)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1 flex items-center gap-2">
                <Mail size={12} className="text-slate-500" />
                Email
              </label>
              <input
                value={draft.cliente_email}
                onChange={e => setDraft(prev => ({ ...prev, cliente_email: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1 flex items-center gap-2">
                <Phone size={12} className="text-slate-500" />
                Telefone
              </label>
              <input
                value={draft.cliente_telefone}
                onChange={e => setDraft(prev => ({ ...prev, cliente_telefone: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300 mb-4">
              <MapPin size={14} className="text-slate-500" />
              Endereço
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">CEP</label>
                <input
                  value={draft.cliente_cep}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_cep: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                  placeholder="00000-000"
                />
              </div>
              <div className="md:col-span-4 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Endereço</label>
                <input
                  value={draft.cliente_endereco}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_endereco: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Rua/Av..."
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Número</label>
                <input
                  value={draft.cliente_numero}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_numero: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                />
              </div>
              <div className="md:col-span-4 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Complemento</label>
                <input
                  value={draft.cliente_complemento}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_complemento: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Bairro</label>
                <input
                  value={draft.cliente_bairro}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_bairro: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Cidade</label>
                <input
                  value={draft.cliente_cidade}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_cidade: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">UF</label>
                <input
                  value={draft.cliente_uf}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_uf: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none uppercase"
                  placeholder="SP"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">País</label>
                <input
                  value={draft.cliente_pais}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_pais: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none uppercase"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300 mb-4">
              <BadgeCheck size={14} className="text-slate-500" />
              Fiscal / Tributário
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Inscrição Estadual</label>
                <input
                  value={draft.cliente_inscricao_estadual}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_inscricao_estadual: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Inscrição Municipal</label>
                <input
                  value={draft.cliente_inscricao_municipal}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_inscricao_municipal: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDraft(prev => ({ ...prev, cliente_optante_simples_nacional: !prev.cliente_optante_simples_nacional, cliente_regime_tributario: !prev.cliente_optante_simples_nacional ? 'SIMPLES_NACIONAL' : prev.cliente_regime_tributario }))}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    draft.cliente_optante_simples_nacional ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  Optante Simples Nacional
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Regime Tributário</label>
                <select
                  value={draft.cliente_regime_tributario}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_regime_tributario: e.target.value as any }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                >
                  <option value="">Não informado</option>
                  {regimeOptions.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                <Globe2 size={14} className="text-slate-500" />
                Presença Digital
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Website</label>
                <input
                  value={draft.cliente_website}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_website: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="https://"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={draft.cliente_instagram}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_instagram: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Instagram"
                />
                <input
                  value={draft.cliente_facebook}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_facebook: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  placeholder="Facebook"
                />
                <input
                  value={draft.cliente_linkedin}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_linkedin: e.target.value }))}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none md:col-span-2"
                  placeholder="LinkedIn"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                <Tags size={14} className="text-slate-500" />
                CRM / Classificação
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Origem do Lead</label>
                  <select
                    value={draft.cliente_origem_lead}
                    onChange={e => setDraft(prev => ({ ...prev, cliente_origem_lead: e.target.value }))}
                    className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  >
                    <option value="">Não informado</option>
                    {origensLead.map(o => (
                      <option key={o.id} value={o.label}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Vertical</label>
                  <select
                    value={draft.cliente_vertical}
                    onChange={e => setDraft(prev => ({ ...prev, cliente_vertical: e.target.value }))}
                    className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                  >
                    <option value="">Não informado</option>
                    {draft.cliente_vertical && !verticais.some(v => v.label === draft.cliente_vertical) && (
                      <option value={draft.cliente_vertical}>{draft.cliente_vertical}</option>
                    )}
                    {verticais.map(v => (
                      <option key={v.id} value={v.label}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Tags</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleTag('CLIENTE')}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                      (draft.cliente_tags || []).includes('CLIENTE') ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    CLIENTE
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTag('FORNECEDOR')}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                      (draft.cliente_tags || []).includes('FORNECEDOR') ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    FORNECEDOR
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observações</label>
                <textarea
                  value={draft.cliente_observacoes}
                  onChange={e => setDraft(prev => ({ ...prev, cliente_observacoes: e.target.value }))}
                  className="w-full h-32 rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none"
                  placeholder="Notas fiscais, preferências, histórico..."
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                <Users size={14} className="text-slate-500" />
                Contatos
              </div>
              <button
                type="button"
                onClick={openContatoCreate}
                disabled={!activeId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/15 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                <UserPlus size={16} />
                Adicionar contato
              </button>
            </div>

            {!activeId ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-300">Salve o cliente para cadastrar contatos.</p>
              </div>
            ) : contatosLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="animate-spin text-slate-500" size={24} />
              </div>
            ) : contatos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-300">Nenhum contato cadastrado para este cliente.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/5">
                <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
                  <div className="col-span-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Contato</div>
                  <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Cargo</div>
                  <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Comunicação</div>
                  <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</div>
                </div>
                <div className="divide-y divide-white/5">
                  {contatos.map(c => (
                    <div key={c.contato_id} className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0B1220]/60 hover:bg-[#0B1220] transition-colors">
                      <div className="col-span-5 min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate">{c.contato_nome}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">#{c.contato_id.split('-')[0]}</div>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-slate-300 truncate">
                          <Briefcase size={14} className="text-slate-500" />
                          <span className="truncate">{c.contato_cargo || '-'}</span>
                        </div>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-slate-300 truncate">
                          <Phone size={14} className="text-slate-500" />
                          <span className="truncate">{c.contato_telefone01 || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400 truncate mt-1">
                          <AtSign size={14} className="text-slate-500" />
                          <span className="truncate">{c.contato_email || '-'}</span>
                        </div>
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => openContatoEdit(c.contato_id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-colors"
                          title="Editar contato"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (saving) return
              setIsFormOpen(false)
              setActiveId(null)
            }}
            className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
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
        </div>
      </Modal>

      <Modal
        isOpen={isContatoOpen}
        onClose={() => {
          if (contatoSaving) return
          setIsContatoOpen(false)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <UserPlus size={18} className="text-cyan-300" />
            </div>
            {contatoActiveId ? 'Editar Contato' : 'Adicionar Contato'}
          </div>
        }
        size="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsContatoOpen(false)}
              disabled={contatoSaving}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSaveContato}
              disabled={contatoSaving}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
            >
              {contatoSaving ? (
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
        <div className="space-y-5">
          {contatoError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {contatoError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Nome</label>
              <input
                value={contatoDraft.contato_nome}
                onChange={e => setContatoDraft(prev => ({ ...prev, contato_nome: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="Ex: João da Silva"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">ID Integração</label>
              <input
                value={contatoDraft.integ_id}
                onChange={e => setContatoDraft(prev => ({ ...prev, integ_id: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="Ex: OMIE_CONTATO_123"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Cargo</label>
              <input
                value={contatoDraft.contato_cargo}
                onChange={e => setContatoDraft(prev => ({ ...prev, contato_cargo: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="Ex: Compras, Financeiro..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Email</label>
              <input
                value={contatoDraft.contato_email}
                onChange={e => setContatoDraft(prev => ({ ...prev, contato_email: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="email@empresa.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Telefone 01</label>
              <input
                value={contatoDraft.contato_telefone01}
                onChange={e => setContatoDraft(prev => ({ ...prev, contato_telefone01: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Telefone 02</label>
              <input
                value={contatoDraft.contato_telefone02}
                onChange={e => setContatoDraft(prev => ({ ...prev, contato_telefone02: e.target.value }))}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observações</label>
            <textarea
              value={contatoDraft.contato_obs}
              onChange={e => setContatoDraft(prev => ({ ...prev, contato_obs: e.target.value }))}
              className="w-full h-28 rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none"
              placeholder="Observações do contato..."
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isTransferOpen}
        onClose={() => {
          if (transferring) return
          setIsTransferOpen(false)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ArrowRightLeft size={18} className="text-amber-300" />
            </div>
            Transferir Cliente
          </div>
        }
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsTransferOpen(false)}
              disabled={transferring}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onTransfer}
              disabled={transferring}
              className="px-7 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
            >
              {transferring ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Transferindo...
                </>
              ) : (
                'Transferir'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {active && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-sm font-semibold text-slate-100 truncate">{active.cliente_nome_razao_social}</div>
              <div className="text-xs text-slate-500 font-mono mt-1">{active.cliente_documento_formatado || active.cliente_documento || '-'}</div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Novo vendedor</label>
            <select
              value={transferUserId}
              onChange={e => setTransferUserId(e.target.value)}
              className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              disabled={usuariosLoading}
            >
              <option value="" disabled>
                {usuariosLoading ? 'Carregando...' : 'Selecione'}
              </option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isHistoryOpen}
        onClose={() => {
          if (historyLoading) return
          setIsHistoryOpen(false)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <History size={18} className="text-slate-200" />
            </div>
            Histórico do Cliente
          </div>
        }
        size="xl"
      >
        <div className="space-y-5">
          {active && (
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <div className="text-sm font-semibold text-slate-100">{active.cliente_nome_razao_social}</div>
              <div className="text-xs text-slate-400 mt-1">
                Documento:{' '}
                <span className="font-mono text-slate-200">{active.cliente_documento_formatado || active.cliente_documento || '-'}</span>
              </div>
            </div>
          )}

          {historyLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-slate-500" size={28} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">Oportunidades</div>
                {historyOportunidades.length === 0 ? (
                  <div className="text-sm text-slate-400">Nenhuma oportunidade vinculada.</div>
                ) : (
                  <div className="space-y-2">
                    {historyOportunidades.slice(0, 12).map((o: any) => (
                      <div key={o.id_oport} className="rounded-xl border border-white/10 bg-[#0B1220] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-200 truncate">
                            {o.cod_oport || o.id_oport?.slice?.(0, 8) || 'Oportunidade'}
                          </div>
                          <div className="text-[10px] text-slate-500">{o.data_inclusao ? new Date(o.data_inclusao).toLocaleDateString() : ''}</div>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {o.fase || o.id_fase || '-'} · {o.status || o.id_status || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">Contatos</div>
                {historyContatos.length === 0 ? (
                  <div className="text-sm text-slate-400">Nenhum contato vinculado.</div>
                ) : (
                  <div className="space-y-2">
                    {historyContatos.slice(0, 12).map(c => (
                      <div key={c.contato_id} className="rounded-xl border border-white/10 bg-[#0B1220] px-3 py-2">
                        <div className="text-sm font-semibold text-slate-200 truncate">{c.contato_nome}</div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {(c.contato_email || '-') + ' · ' + (c.contato_telefone01 || '-')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
