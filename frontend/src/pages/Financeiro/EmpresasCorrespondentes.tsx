import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Pencil, Plus, Search, Settings, Trash2, Upload } from 'lucide-react'
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

const HeaderCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-5 shadow-sm">{children}</div>
)

export default function EmpresasCorrespondentes() {
  const { session, profile } = useAuth()
  const userId = (profile?.id || session?.user?.id || '').trim()

  const [items, setItems] = useState<FinEmpresaCorrespondente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = useMemo(() => items.find((i) => i.empresa_id === activeId) || null, [items, activeId])

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFinEmpresasCorrespondentes()
      setItems(data)
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
      setActiveId(null)
      setLogoFile(null)
      setLogoPreview('')
      await load()
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
              return (
                <div key={i.empresa_id} className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0B1220]/60 hover:bg-[#0B1220] transition-colors">
                  <div className="col-span-1 flex items-center">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-contain bg-white/5 border border-white/10" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10" />
                    )}
                  </div>
                  <div className="col-span-5 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{i.nome_fantasia || '-'}</div>
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
                      onClick={() => openEdit(i.empresa_id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => askDelete(i.empresa_id)}
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
        isOpen={isFormOpen}
        onClose={() => {
          if (saving) return
          setIsFormOpen(false)
          setActiveId(null)
        }}
        title={active ? `Editar Empresa (${active.nome_fantasia || active.razao_social || 'Empresa'})` : 'Nova Empresa'}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
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
          <p className="text-sm text-slate-300">Essa ação não pode ser desfeita.</p>
        </div>
      </Modal>
    </div>
  )
}
