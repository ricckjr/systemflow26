import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, FilePlus, Calendar, Building2, User, UserPlus, Key, Info, CheckCircle2, AlertTriangle, Download, Trash2, Upload } from 'lucide-react'
import { Modal } from '@/components/ui'
import { useUsuarios, UsuarioSimples } from '@/hooks/useUsuarios'
import { fetchFinEmpresasCorrespondentes, FinEmpresaCorrespondente } from '@/services/financeiro'
import { api } from '@/services/api'

import { supabase } from '@/services/supabase'

// --- Tipos ---

type ColaboradorDocumento = {
  id: string
  nome: string
  arquivoNome?: string | null
  arquivoUrl?: string | null
  dataEmissao?: string | null
  dataVencimento?: string | null
  createdAt: string
}

type UsuarioSistema = UsuarioSimples & { ativo?: boolean }

type Colaborador = {
  id: string
  empresaId: string
  empresaNome: string
  usuario: UsuarioSistema
  dataAdmissao: string
  
  // Dados Pessoais
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  emailPessoal: string
  telefone: string
  enderecoCompleto: string
  cep: string
  
  // Dados Corporativos
  matricula: string
  departamento: string
  
  documentos: ColaboradorDocumento[]
  docsLoaded?: boolean
  dataDemissao?: string | null
  obsDemissao?: string | null
  createdAt: string
}

interface Perfil {
  perfil_id: string
  perfil_nome: string
  perfil_descricao?: string
}

// --- Helpers ---

const ALERTA_VENCIMENTO_DIAS = 30

function makeId(prefix: string) {
  const uuid = (globalThis.crypto as any)?.randomUUID?.()
  return `${prefix}_${uuid ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`
}

function formatDateBR(dateISO: string) {
  if (!dateISO) return '-'
  const [y, m, d] = dateISO.split('-')
  if (!y || !m || !d) return dateISO
  return `${d}/${m}/${y}`
}

function formatCPF(v: string) {
  v = v.replace(/\D/g, '')
  if (v.length > 11) v = v.substring(0, 11)
  return v
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatCEP(v: string) {
  v = v.replace(/\D/g, '')
  if (v.length > 8) v = v.substring(0, 8)
  return v.replace(/(\d{5})(\d)/, '$1-$2')
}

function formatPhone(v: string) {
  v = v.replace(/\D/g, '')
  if (v.length > 11) v = v.substring(0, 11)
  if (v.length > 10) {
    return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  } else if (v.length > 6) {
    return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  } else if (v.length > 2) {
    return v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
  }
  return v
}

function isMissingTable(error: any) {
  const code = String(error?.code || '')
  const msg = String(error?.message || '')
  if (code === '42P01') return true
  if (code === 'PGRST205') return true
  return msg.includes('schema cache') && msg.includes('Could not find the table')
}

type DocAlertStatus = 'vencido' | 'vencendo'

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

// --- Componente Avatar ---

function Avatar({
  nome,
  avatarUrl,
  size = 44,
}: {
  nome: string
  avatarUrl?: string | null
  size?: number
}) {
  const initial = (nome || 'U').substring(0, 1).toUpperCase()
  return (
    <div
      className="rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/10"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-slate-300">{initial}</span>
      )}
    </div>
  )
}

// --- Página Principal ---

export default function Colaboradores() {
  const { usuarios, loading: loadingUsuarios } = useUsuarios() // Hook existente (apenas carrega)
  const [allUsers, setAllUsers] = useState<UsuarioSistema[]>([]) // Estado local para atualizar após criar
  
  const [empresas, setEmpresas] = useState<FinEmpresaCorrespondente[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingAux, setLoadingAux] = useState(true)
  const [docsAlertaMap, setDocsAlertaMap] = useState<Record<string, DocAlertStatus>>({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'desativados'>('ativos')
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])

  // Modais
  const [isNovoOpen, setIsNovoOpen] = useState(false)
  const [isDetalheOpen, setIsDetalheOpen] = useState(false)
  const [isDocumentoOpen, setIsDocumentoOpen] = useState(false)
  const [isDeleteDocOpen, setIsDeleteDocOpen] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeColaborador = useMemo(() => colaboradores.find((c) => c.id === activeId) ?? null, [activeId, colaboradores])

  // --- Form Novo Colaborador ---
  const [currentTab, setCurrentTab] = useState<'pessoal' | 'corporativo' | 'acesso'>('pessoal')
  
  // Dados Pessoais
  const [novoNomeCompleto, setNovoNomeCompleto] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [novoDataNascimento, setNovoDataNascimento] = useState('')
  const [novoEmailPessoal, setNovoEmailPessoal] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [novoCep, setNovoCep] = useState('')

  // Dados Corporativos
  const [novoEmpresaId, setNovoEmpresaId] = useState('')
  const [novoMatricula, setNovoMatricula] = useState('')
  const [novoDepartamento, setNovoDepartamento] = useState('')
  const [novoDataAdmissao, setNovoDataAdmissao] = useState('')
  const [novoEmailCorporativo, setNovoEmailCorporativo] = useState('')
  const [novoRamal, setNovoRamal] = useState('')

  const [completarUsuario, setCompletarUsuario] = useState<UsuarioSistema | null>(null)
  const [novoAvatarFile, setNovoAvatarFile] = useState<File | null>(null)
  const [novoAvatarPreview, setNovoAvatarPreview] = useState('')

  // Criar novo
  const [novoAcessoEmail, setNovoAcessoEmail] = useState('') // Login
  const [novoAcessoSenha, setNovoAcessoSenha] = useState('')
  const [novoAcessoPerfilId, setNovoAcessoPerfilId] = useState('')

  const [novoError, setNovoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Documentos
  const [docNome, setDocNome] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docEmissao, setDocEmissao] = useState('')
  const [docVencimento, setDocVencimento] = useState('')
  const [docError, setDocError] = useState<string | null>(null)
  const [savingDoc, setSavingDoc] = useState(false)
  const savingDocRef = useRef(false)

  const [isResetSenhaOpen, setIsResetSenhaOpen] = useState(false)
  const [resetSenha, setResetSenha] = useState('')
  const [resetSenhaError, setResetSenhaError] = useState<string | null>(null)
  const [resettingSenha, setResettingSenha] = useState(false)

  const [isDesativarOpen, setIsDesativarOpen] = useState(false)
  const [demissaoData, setDemissaoData] = useState('')
  const [demissaoObs, setDemissaoObs] = useState('')
  const [desativarError, setDesativarError] = useState<string | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)

  const [isEditarOpen, setIsEditarOpen] = useState(false)
  const [editNomeCompleto, setEditNomeCompleto] = useState('')
  const [editCpf, setEditCpf] = useState('')
  const [editDataNascimento, setEditDataNascimento] = useState('')
  const [editEmailPessoal, setEditEmailPessoal] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editEndereco, setEditEndereco] = useState('')
  const [editCep, setEditCep] = useState('')
  const [editEmpresaId, setEditEmpresaId] = useState('')
  const [editMatricula, setEditMatricula] = useState('')
  const [editDepartamento, setEditDepartamento] = useState('')
  const [editDataAdmissao, setEditDataAdmissao] = useState('')
  const [editEmailCorporativo, setEditEmailCorporativo] = useState('')
  const [editRamal, setEditRamal] = useState('')
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null)
  const [editAvatarPreview, setEditAvatarPreview] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // --- Loads ---

  useEffect(() => {
    let mounted = true
    async function loadData() {
      try {
        setLoadingInit(true)

        const { data: colabData, error: colabError } = await supabase
          .from('colaboradores')
          .select(`
            *,
            empresa:fin_empresas_correspondentes(nome_fantasia, razao_social),
            usuario:profiles(id, nome, email_login, email_corporativo, telefone, ramal, cargo, avatar_url, ativo)
          `)
          .order('created_at', { ascending: false })

        if (!mounted) return

        if (colabError) {
          if (isMissingTable(colabError)) {
            setColaboradores([])
            return
          }
          throw colabError
        }

        if (colabData) {
          const mappedColabs: Colaborador[] = colabData.map((c: any) => ({
            id: c.id,
            empresaId: c.empresa_id,
            empresaNome: c.empresa?.nome_fantasia || c.empresa?.razao_social || 'Empresa',
            usuario: {
              id: c.usuario?.id,
              nome: c.usuario?.nome || c.nome_completo,
              email_login: c.usuario?.email_login || '',
              email_corporativo: c.usuario?.email_corporativo || c.email_corporativo,
              telefone: c.usuario?.telefone || c.telefone,
              ramal: c.usuario?.ramal || c.ramal,
              cargo: c.usuario?.cargo || c.departamento,
              avatar_url: c.usuario?.avatar_url,
              ativo: c.usuario?.ativo
            },
            dataAdmissao: c.data_admissao,
            nomeCompleto: c.nome_completo,
            cpf: c.cpf,
            dataNascimento: c.data_nascimento,
            emailPessoal: c.email_pessoal,
            telefone: c.telefone,
            enderecoCompleto: c.endereco_completo,
            cep: c.cep,
            matricula: c.matricula,
            departamento: c.departamento,
            documentos: [],
            docsLoaded: false,
            dataDemissao: c.data_demissao,
            obsDemissao: c.obs_demissao,
            createdAt: c.created_at
          }))
          setColaboradores(mappedColabs)
        }

        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        const limite = new Date(hoje)
        limite.setDate(limite.getDate() + ALERTA_VENCIMENTO_DIAS)
        const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`

        ;(async () => {
          try {
            const { data, error } = await supabase
              .from('colaboradores_documentos')
              .select('colaborador_id, data_vencimento')
              .lte('data_vencimento', limiteISO)
              .not('data_vencimento', 'is', null)

            if (error) throw error
            const map: Record<string, DocAlertStatus> = {}
            ;(data ?? []).forEach((row: any) => {
              const id = String(row?.colaborador_id || '')
              if (!id) return
              const status = getDocAlertStatus(row?.data_vencimento)
              if (!status) return
              map[id] = mergeDocAlertStatus(map[id], status) as DocAlertStatus
            })
            if (mounted) setDocsAlertaMap(map)
          } catch (e) {
            console.error(e)
          }
        })()

        setLoadingAux(true)
        ;(async () => {
          try {
            const [empresasData, perfisData, usersData] = await Promise.all([
              fetchFinEmpresasCorrespondentes(),
              api.rbac.listPerfis(),
              api.users.list(1, 1000)
            ])

            if (!mounted) return
            setEmpresas((empresasData ?? []).filter((e) => e.ativo))
            setPerfis(perfisData?.perfis ?? [])

            const mappedUsers = (usersData?.users ?? []).map((u: any) => ({
              id: u.id,
              nome: u.nome,
              email_login: u.email_login,
              email_corporativo: u.email_corporativo,
              telefone: u.telefone,
              ramal: u.ramal,
              cargo: u.cargo,
              avatar_url: u.avatar_url,
              ativo: u.ativo
            }))
            setAllUsers(mappedUsers)
          } catch (e) {
            console.error(e)
          } finally {
            if (mounted) setLoadingAux(false)
          }
        })()
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setLoadingInit(false)
      }
    }
    loadData()
    return () => { mounted = false }
  }, [])

  // Atualiza email de login automático ao digitar email corporativo
  useEffect(() => {
    if (novoEmailCorporativo && !novoAcessoEmail) {
      setNovoAcessoEmail(novoEmailCorporativo)
    }
  }, [novoEmailCorporativo])

  useEffect(() => {
    if (!novoAvatarFile) {
      setNovoAvatarPreview('')
      return
    }
    const url = URL.createObjectURL(novoAvatarFile)
    setNovoAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [novoAvatarFile])

  useEffect(() => {
    if (!editAvatarFile) {
      setEditAvatarPreview('')
      return
    }
    const url = URL.createObjectURL(editAvatarFile)
    setEditAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [editAvatarFile])

  // --- Filtros ---

  const colaboradoresByUserId = useMemo(() => {
    const map: Record<string, Colaborador> = {}
    colaboradores.forEach((c) => {
      const userId = String(c.usuario?.id || '')
      if (!userId) return
      map[userId] = c
    })
    return map
  }, [colaboradores])

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = allUsers.filter((u) => {
      const ativo = u.ativo !== false
      return statusFilter === 'ativos' ? ativo : !ativo
    }).map((u) => ({ user: u, colab: colaboradoresByUserId[u.id] ?? null }))
    if (!q) return base
    return base.filter(({ user, colab }) => {
      const nome = String(user.nome || '').toLowerCase()
      const cargo = String(user.cargo || colab?.departamento || '').toLowerCase()
      const empresaNome = String(colab?.empresaNome || '').toLowerCase()
      return nome.includes(q) || cargo.includes(q) || empresaNome.includes(q)
    })
  }, [allUsers, colaboradoresByUserId, search, statusFilter])

  // --- Actions ---

  const refreshDocsVencendo = async (colaboradorId?: string) => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const limite = new Date(hoje)
    limite.setDate(limite.getDate() + ALERTA_VENCIMENTO_DIAS)
    const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`

    let query = supabase
      .from('colaboradores_documentos')
      .select('colaborador_id, data_vencimento')
      .lte('data_vencimento', limiteISO)
      .not('data_vencimento', 'is', null)

    if (colaboradorId) query = query.eq('colaborador_id', colaboradorId)

    const { data, error } = await query
    if (error) throw error

    if (colaboradorId) {
      let status: DocAlertStatus | null = null
      ;(data ?? []).forEach((row: any) => {
        status = mergeDocAlertStatus(status, getDocAlertStatus(row?.data_vencimento))
      })
      setDocsAlertaMap((prev) => {
        const next = { ...prev }
        if (status) next[colaboradorId] = status
        else delete next[colaboradorId]
        return next
      })
      return
    }

    const map: Record<string, DocAlertStatus> = {}
    ;(data ?? []).forEach((row: any) => {
      const id = String(row?.colaborador_id || '')
      if (!id) return
      const status = getDocAlertStatus(row?.data_vencimento)
      if (!status) return
      map[id] = mergeDocAlertStatus(map[id], status) as DocAlertStatus
    })
    setDocsAlertaMap(map)
  }

  const ensureDocsLoaded = async (colaboradorId: string) => {
    const target = colaboradores.find((c) => c.id === colaboradorId)
    if (!target || target.docsLoaded) return

    const { data, error } = await supabase
      .from('colaboradores_documentos')
      .select('id, nome, arquivo_nome, arquivo_url, data_emissao, data_vencimento, created_at')
      .eq('colaborador_id', colaboradorId)
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTable(error)) return
      throw error
    }

    const docs: ColaboradorDocumento[] = (data ?? []).map((d: any) => ({
      id: d.id,
      nome: d.nome,
      arquivoNome: d.arquivo_nome,
      arquivoUrl: d.arquivo_url,
      dataEmissao: d.data_emissao,
      dataVencimento: d.data_vencimento,
      createdAt: d.created_at
    }))

    setColaboradores((prev) =>
      prev.map((c) => (c.id === colaboradorId ? { ...c, docsLoaded: true, documentos: docs } : c))
    )
    try {
      await refreshDocsVencendo(colaboradorId)
    } catch (e) {
      console.error(e)
    }
  }

  const openDetalhe = (colaboradorId: string) => {
    setActiveId(colaboradorId)
    setIsDetalheOpen(true)
    void ensureDocsLoaded(colaboradorId)
  }

  const openNovo = () => {
    // Reset Form
    setCurrentTab('pessoal')
    
    setNovoNomeCompleto('')
    setNovoCpf('')
    setNovoDataNascimento('')
    setNovoEmailPessoal('')
    setNovoTelefone('')
    setNovoEndereco('')
    setNovoCep('')
    
    setNovoEmpresaId('')
    setNovoMatricula('')
    setNovoDepartamento('')
    setNovoDataAdmissao('')
    setNovoEmailCorporativo('')
    setNovoRamal('')

    setCompletarUsuario(null)
    setNovoAvatarFile(null)
    setNovoAcessoEmail('')
    setNovoAcessoSenha('')
    // Tenta selecionar perfil padrão
    const defPerfil = perfis.find(p => p.perfil_nome === 'VENDEDOR' || p.perfil_nome === 'COMERCIAL')
    setNovoAcessoPerfilId(defPerfil?.perfil_id || '')

    setNovoError(null)
    setIsNovoOpen(true)
  }

  const openCompletarCadastroFromUser = (u: UsuarioSistema) => {
    setCurrentTab('pessoal')
    setCompletarUsuario(u)
    setNovoAvatarFile(null)

    setNovoNomeCompleto(u.nome || '')
    setNovoCpf('')
    setNovoDataNascimento('')
    setNovoEmailPessoal(u.email_login || '')
    setNovoTelefone(u.telefone || '')
    setNovoEndereco('')
    setNovoCep('')

    setNovoEmpresaId('')
    setNovoMatricula('')
    setNovoDepartamento(u.cargo || '')
    setNovoDataAdmissao('')
    setNovoEmailCorporativo(u.email_corporativo || '')
    setNovoRamal(u.ramal || '')
    setNovoAcessoEmail('')
    setNovoAcessoSenha('')
    setNovoAcessoPerfilId('')

    setNovoError(null)
    setIsNovoOpen(true)
  }

  const closeNovo = () => setIsNovoOpen(false)

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

  const openResetSenha = () => {
    if (!activeColaborador) return
    setResetSenha('')
    setResetSenhaError(null)
    setIsResetSenhaOpen(true)
  }

  const openDesativar = () => {
    if (!activeColaborador) return
    setDemissaoData('')
    setDemissaoObs('')
    setDesativarError(null)
    setIsDesativarOpen(true)
  }

  const openEditar = () => {
    if (!activeColaborador) return
    setEditAvatarFile(null)
    setEditNomeCompleto(activeColaborador.nomeCompleto)
    setEditCpf(activeColaborador.cpf)
    setEditDataNascimento(activeColaborador.dataNascimento)
    setEditEmailPessoal(activeColaborador.emailPessoal)
    setEditTelefone(activeColaborador.telefone)
    setEditEndereco(activeColaborador.enderecoCompleto)
    setEditCep(activeColaborador.cep)
    setEditEmpresaId(activeColaborador.empresaId)
    setEditMatricula(activeColaborador.matricula)
    setEditDepartamento(activeColaborador.departamento)
    setEditDataAdmissao(activeColaborador.dataAdmissao)
    setEditEmailCorporativo(activeColaborador.usuario.email_corporativo || '')
    setEditRamal(activeColaborador.usuario.ramal || '')
    setEditError(null)
    setIsEditarOpen(true)
  }

  const fileToDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Falha ao ler arquivo.'))
      reader.readAsDataURL(file)
    })
  }, [])

  const handleSave = async () => {
    setNovoError(null)
    setSaving(true)

    try {
      // 1. Validações Básicas
      if (!novoNomeCompleto) throw new Error('Nome Completo é obrigatório.')
      if (!novoCpf) throw new Error('CPF é obrigatório.')
      if (!novoDataNascimento) throw new Error('Data de Nascimento é obrigatória.')
      if (!novoEmailPessoal) throw new Error('Email Pessoal é obrigatório.')
      if (!novoTelefone) throw new Error('Telefone é obrigatório.')
      if (!novoEndereco) throw new Error('Endereço é obrigatório.')
      if (!novoCep) throw new Error('CEP é obrigatório.')
      
      if (!novoEmpresaId) throw new Error('Empresa é obrigatória.')
      if (!novoMatricula) throw new Error('Matrícula é obrigatória.')
      if (!novoDepartamento) throw new Error('Departamento é obrigatório.')
      if (!novoDataAdmissao) throw new Error('Data de Admissão é obrigatória.')

      let usuarioFinal: UsuarioSistema | null = null

      // 2. Lógica de Usuário
      if (completarUsuario) {
        usuarioFinal = completarUsuario
      } else {
        if (!novoAcessoEmail) throw new Error('Email de Login é obrigatório para criar usuário.')
        if (!novoAcessoSenha || novoAcessoSenha.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres.')
        if (!novoAcessoPerfilId) throw new Error('Perfil de Acesso é obrigatório.')

        const cargo = novoDepartamento
        const userPayload = {
          nome: novoNomeCompleto,
          email_login: novoAcessoEmail,
          email_corporativo: novoEmailCorporativo,
          telefone: novoTelefone,
          ramal: novoRamal,
          senha: novoAcessoSenha,
          ativo: true,
          cargo: cargo.toUpperCase()
        }

        const resp = await api.users.create(userPayload)
        const userId = resp?.user?.id
        if (!userId) throw new Error('Falha ao criar usuário no sistema.')

        await api.rbac.assignUserPerfil(userId, novoAcessoPerfilId)

        usuarioFinal = {
          id: userId,
          nome: novoNomeCompleto,
          email_login: novoAcessoEmail,
          email_corporativo: novoEmailCorporativo,
          telefone: novoTelefone,
          ramal: novoRamal,
          cargo: cargo.toUpperCase(),
          avatar_url: null,
          ativo: true
        }

        setAllUsers(prev => [usuarioFinal!, ...prev])
      }

      if (novoAvatarFile) {
        const dataUrl = await fileToDataUrl(novoAvatarFile)
        const r = await api.users.setAvatar(usuarioFinal!.id, dataUrl)
        const avatarUrl = r?.avatar_url ?? null
        usuarioFinal = { ...usuarioFinal!, avatar_url: avatarUrl }
        setAllUsers((prev) => prev.map((u) => (u.id === usuarioFinal!.id ? { ...u, avatar_url: avatarUrl } : u)))
        setCompletarUsuario((prev) => (prev?.id === usuarioFinal!.id ? { ...prev, avatar_url: avatarUrl } : prev))
      }

      // 3. Criar Colaborador no Banco
      const empresa = empresas.find(e => e.empresa_id === novoEmpresaId)
      
      const payloadColaborador = {
        user_id: usuarioFinal!.id,
        empresa_id: novoEmpresaId,
        nome_completo: novoNomeCompleto,
        cpf: novoCpf,
        data_nascimento: novoDataNascimento,
        email_pessoal: novoEmailPessoal,
        telefone: novoTelefone,
        endereco_completo: novoEndereco,
        cep: novoCep,
        matricula: novoMatricula,
        departamento: novoDepartamento,
        data_admissao: novoDataAdmissao,
        email_corporativo: novoEmailCorporativo || null,
        ramal: novoRamal || null
      }

      const { data: createdColab, error: createError } = await supabase
        .from('colaboradores')
        .insert(payloadColaborador)
        .select()
        .single()

      if (createError) {
        if (isMissingTable(createError)) {
          throw new Error(
            "Tabela 'colaboradores' ainda não foi criada no banco. Aplique a migration 20260218_create_colaboradores.sql e recarregue o schema cache do Supabase."
          )
        }
        throw new Error(createError.message || 'Erro ao salvar colaborador no banco.')
      }

      const novoColaborador: Colaborador = {
        id: createdColab.id,
        empresaId: novoEmpresaId,
        empresaNome: empresa?.nome_fantasia || 'Empresa',
        usuario: usuarioFinal!,
        dataAdmissao: novoDataAdmissao,
        
        nomeCompleto: novoNomeCompleto,
        cpf: novoCpf,
        dataNascimento: novoDataNascimento,
        emailPessoal: novoEmailPessoal,
        telefone: novoTelefone,
        enderecoCompleto: novoEndereco,
        cep: novoCep,
        
        matricula: novoMatricula,
        departamento: novoDepartamento,
        
        documentos: [],
        createdAt: createdColab.created_at,
      }

      setColaboradores(prev => [novoColaborador, ...prev])
      setIsNovoOpen(false)
      setCompletarUsuario(null)

    } catch (err: any) {
      setNovoError(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmResetSenha = async () => {
    if (!activeColaborador) return
    setResetSenhaError(null)
    setResettingSenha(true)
    try {
      if (!resetSenha || resetSenha.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres.')
      await api.users.resetPassword(activeColaborador.usuario.id, resetSenha)
      setIsResetSenhaOpen(false)
      setResetSenha('')
    } catch (err: any) {
      setResetSenhaError(err.message || 'Erro ao resetar senha.')
    } finally {
      setResettingSenha(false)
    }
  }

  const handleConfirmDesativar = async () => {
    if (!activeColaborador) return
    setDesativarError(null)
    setChangingStatus(true)
    const colabId = activeColaborador.id
    const userId = activeColaborador.usuario.id
    try {
      if (!demissaoData) throw new Error('Data da Demissão é obrigatória.')
      if (!demissaoObs) throw new Error('Observação é obrigatória.')

      const { error: upErr } = await supabase
        .from('colaboradores')
        .update({ data_demissao: demissaoData, obs_demissao: demissaoObs })
        .eq('id', colabId)

      if (upErr) {
        if (isMissingTable(upErr)) {
          throw new Error(
            "Tabela 'colaboradores' ainda não foi criada no banco. Aplique a migration 20260218_create_colaboradores.sql e recarregue o schema cache do Supabase."
          )
        }
        throw upErr
      }

      try {
        await api.users.disable(userId)
      } catch (e: any) {
        await supabase.from('colaboradores').update({ data_demissao: null, obs_demissao: null }).eq('id', colabId)
        throw e
      }

      setColaboradores((prev) =>
        prev.map((c) =>
          c.id === colabId
            ? { ...c, dataDemissao: demissaoData, obsDemissao: demissaoObs, usuario: { ...c.usuario, ativo: false } }
            : c
        )
      )
      setIsDesativarOpen(false)
    } catch (err: any) {
      setDesativarError(err.message || 'Erro ao desativar usuário.')
    } finally {
      setChangingStatus(false)
    }
  }

  const handleReativar = async () => {
    if (!activeColaborador) return
    setDesativarError(null)
    setChangingStatus(true)
    const colabId = activeColaborador.id
    const userId = activeColaborador.usuario.id
    try {
      await api.users.enable(userId)

      const { error: upErr } = await supabase
        .from('colaboradores')
        .update({ data_demissao: null, obs_demissao: null })
        .eq('id', colabId)

      if (upErr) {
        if (isMissingTable(upErr)) {
          throw new Error(
            "Tabela 'colaboradores' ainda não foi criada no banco. Aplique a migration 20260218_create_colaboradores.sql e recarregue o schema cache do Supabase."
          )
        }
        throw upErr
      }

      setColaboradores((prev) =>
        prev.map((c) => (c.id === colabId ? { ...c, dataDemissao: null, obsDemissao: null, usuario: { ...c.usuario, ativo: true } } : c))
      )
    } catch (err: any) {
      setDesativarError(err.message || 'Erro ao reativar usuário.')
    } finally {
      setChangingStatus(false)
    }
  }

  const handleSalvarEdicao = async () => {
    if (!activeColaborador) return
    setEditError(null)
    setSavingEdit(true)
    try {
      if (!editNomeCompleto) throw new Error('Nome Completo é obrigatório.')
      if (!editCpf) throw new Error('CPF é obrigatório.')
      if (!editDataNascimento) throw new Error('Data de Nascimento é obrigatória.')
      if (!editEmailPessoal) throw new Error('Email Pessoal é obrigatório.')
      if (!editTelefone) throw new Error('Telefone é obrigatório.')
      if (!editEndereco) throw new Error('Endereço é obrigatório.')
      if (!editCep) throw new Error('CEP é obrigatório.')

      if (!editEmpresaId) throw new Error('Empresa é obrigatória.')
      if (!editMatricula) throw new Error('Matrícula é obrigatória.')
      if (!editDepartamento) throw new Error('Departamento é obrigatório.')
      if (!editDataAdmissao) throw new Error('Data de Admissão é obrigatória.')

      const { data: updated, error: upErr } = await supabase
        .from('colaboradores')
        .update({
          empresa_id: editEmpresaId,
          nome_completo: editNomeCompleto,
          cpf: editCpf,
          data_nascimento: editDataNascimento,
          email_pessoal: editEmailPessoal,
          telefone: editTelefone,
          endereco_completo: editEndereco,
          cep: editCep,
          matricula: editMatricula,
          departamento: editDepartamento,
          data_admissao: editDataAdmissao,
          email_corporativo: editEmailCorporativo || null,
          ramal: editRamal || null
        })
        .eq('id', activeColaborador.id)
        .select()
        .single()

      if (upErr) {
        if (isMissingTable(upErr)) {
          throw new Error(
            "Tabela 'colaboradores' ainda não foi criada no banco. Aplique a migration 20260218_create_colaboradores.sql e recarregue o schema cache do Supabase."
          )
        }
        throw upErr
      }

      await api.users.update(activeColaborador.usuario.id, {
        nome: editNomeCompleto,
        telefone: editTelefone,
        email_corporativo: editEmailCorporativo || null,
        ramal: editRamal || null,
        cargo: editDepartamento
      })

      let avatarUrl: string | null | undefined = undefined
      if (editAvatarFile) {
        const dataUrl = await fileToDataUrl(editAvatarFile)
        const r = await api.users.setAvatar(activeColaborador.usuario.id, dataUrl)
        avatarUrl = r?.avatar_url ?? null
        setAllUsers((prev) => prev.map((u) => (u.id === activeColaborador.usuario.id ? { ...u, avatar_url: avatarUrl } : u)))
      }

      const empresa = empresas.find((e) => e.empresa_id === editEmpresaId)
      const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || activeColaborador.empresaNome

      setColaboradores((prev) =>
        prev.map((c) =>
          c.id === activeColaborador.id
            ? {
                ...c,
                empresaId: editEmpresaId,
                empresaNome,
                nomeCompleto: editNomeCompleto,
                cpf: editCpf,
                dataNascimento: editDataNascimento,
                emailPessoal: editEmailPessoal,
                telefone: editTelefone,
                enderecoCompleto: editEndereco,
                cep: editCep,
                matricula: editMatricula,
                departamento: editDepartamento,
                dataAdmissao: editDataAdmissao,
                usuario: {
                  ...c.usuario,
                  nome: editNomeCompleto,
                  telefone: editTelefone,
                  email_corporativo: editEmailCorporativo || null,
                  ramal: editRamal || null,
                  cargo: editDepartamento,
                  avatar_url: avatarUrl === undefined ? c.usuario.avatar_url : avatarUrl
                }
              }
            : c
        )
      )

      setIsEditarOpen(false)
    } catch (err: any) {
      setEditError(err.message || 'Erro ao salvar edição.')
    } finally {
      setSavingEdit(false)
    }
  }

  const askDeleteDocumento = (docId: string) => {
    setDeleteDocId(docId)
    setIsDeleteDocOpen(true)
  }

  const handleConfirmDeleteDocumento = async () => {
    const docId = deleteDocId
    if (!docId) return
    try {
      const { error } = await supabase.from('colaboradores_documentos').delete().eq('id', docId)
      if (error) throw error
      
      setColaboradores(prev => prev.map(c => {
        if (c.id !== activeColaborador?.id) return c
        return { ...c, documentos: c.documentos.filter(d => d.id !== docId) }
      }))
      if (activeColaborador?.id) {
        try {
          await refreshDocsVencendo(activeColaborador.id)
        } catch (e) {
          console.error(e)
        }
      }
      setIsDeleteDocOpen(false)
      setDeleteDocId(null)
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir documento.')
    }
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-white">Colaboradores</h1>
          <p className="text-sm text-industrial-text-secondary">Gestão de colaboradores e acessos</p>
        </div>
        <button
          type="button"
          onClick={openNovo}
          disabled={loadingAux}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/15 transition-all active:scale-95 shrink-0"
        >
          <Plus size={16} />
          {loadingAux ? 'Carregando...' : 'Novo Colaborador'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[220px] group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cargo ou empresa..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
          />
        </div>

        <div className="flex items-center rounded-xl border border-white/10 bg-[#0B1220] p-1 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('ativos')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'ativos' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Ativos
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('desativados')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'desativados' ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Desativados
          </button>
        </div>
      </div>

      {/* Listagem */}
      {loadingInit ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-white/10 bg-[#0F172A] p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-white/5" />
                  <div className="h-3 w-1/3 rounded bg-white/5" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-3/4 rounded bg-white/5" />
                <div className="h-3 w-1/2 rounded bg-white/5" />
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="h-3 w-24 rounded bg-white/5" />
                <div className="h-3 w-16 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <UserPlus size={32} className="text-slate-500" />
          </div>
          <p className="text-base font-semibold text-slate-200">Nenhum usuário encontrado</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">Crie usuários ou complete o cadastro para exibir nos cards.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCards.map(({ user, colab }) => {
            const isAtivo = user.ativo !== false
            const statusLoaded = colab?.docsLoaded
              ? colab.documentos.reduce<DocAlertStatus | null>((acc, d) => mergeDocAlertStatus(acc, getDocAlertStatus(d.dataVencimento)), null)
              : null
            const docAlert = colab && isAtivo ? mergeDocAlertStatus(docsAlertaMap[colab.id], statusLoaded) : null
            return (
            <button
              key={user.id}
              type="button"
              onClick={() => (colab ? openDetalhe(colab.id) : openCompletarCadastroFromUser(user))}
              className="text-left rounded-2xl border border-white/10 bg-[#0F172A] p-5 hover:border-cyan-500/30 hover:bg-[#0B1220] transition-colors group relative"
            >
              {docAlert === 'vencido' ? (
                <div className="absolute -top-2 -right-2 p-1.5 bg-orange-500 rounded-full shadow-lg shadow-orange-500/20 animate-pulse z-10" title="Documentos inválidos">
                  <AlertTriangle size={16} className="text-white" />
                </div>
              ) : docAlert === 'vencendo' ? (
                <div className="absolute -top-2 -right-2 p-1.5 bg-amber-500 rounded-full shadow-lg shadow-amber-500/20 animate-pulse z-10" title="Documentos vencendo em breve">
                  <AlertTriangle size={16} className="text-white" />
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <Avatar nome={user.nome} avatarUrl={user.avatar_url} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100 truncate group-hover:text-cyan-400 transition-colors">{user.nome}</div>
                  <div className="text-xs text-slate-400 truncate">{user.cargo || colab?.departamento || '—'}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Building2 size={14} className="text-slate-500" />
                  <span className="truncate">{colab?.empresaNome || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Calendar size={14} className="text-slate-500" />
                  <span>Admissão: {colab?.dataAdmissao ? formatDateBR(colab.dataAdmissao) : '—'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{colab?.docsLoaded ? `${colab.documentos.length} documentos` : '— documentos'}</span>
                {!colab ? (
                  <span className="text-orange-400 font-medium">Cadastro incompleto</span>
                ) : user.ativo === false ? (
                  <span className="text-rose-400 font-medium">Desativado</span>
                ) : (
                  <span className="text-emerald-400 font-medium">Ativo</span>
                )}
              </div>
            </button>
          )})}
        </div>
      )}

      {/* Modal Novo Colaborador */}
      <Modal
        isOpen={isNovoOpen}
        onClose={closeNovo}
        title="Novo Colaborador"
        size="3xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeNovo}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? 'Salvando...' : 'Salvar Cadastro'}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {novoError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              {novoError}
            </div>
          )}

          {/* Abas */}
          <div className="flex items-center gap-1 border-b border-white/10">
            <button
              onClick={() => setCurrentTab('pessoal')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                currentTab === 'pessoal' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Dados Pessoais
            </button>
            <button
              onClick={() => setCurrentTab('corporativo')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                currentTab === 'corporativo' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Contato Corporativo
            </button>
            <button
              onClick={() => setCurrentTab('acesso')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                currentTab === 'acesso' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Credenciais de Acesso
            </button>
          </div>

          <div className="min-h-[300px]">
            {/* Tab: Pessoal */}
            {currentTab === 'pessoal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Foto de Perfil</label>
                  <div className="flex items-center gap-3">
                    <Avatar
                      nome={novoNomeCompleto || completarUsuario?.nome || 'Usuário'}
                      avatarUrl={novoAvatarPreview || completarUsuario?.avatar_url || ''}
                      size={48}
                    />
                    <input
                      type="file"
                      id="colab-avatar-novo"
                      accept="image/png,image/jpeg"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        if (!f) { setNovoAvatarFile(null); return }
                        if (f.size > 3 * 1024 * 1024) { setNovoError('Imagem muito grande (máx 3MB).'); setNovoAvatarFile(null); return }
                        if (f.type !== 'image/png' && f.type !== 'image/jpeg') { setNovoError('Formato inválido. Use PNG ou JPEG.'); setNovoAvatarFile(null); return }
                        setNovoAvatarFile(f)
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="colab-avatar-novo"
                      className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Selecionar foto
                    </label>
                    {novoAvatarFile && (
                      <button
                        type="button"
                        onClick={() => setNovoAvatarFile(null)}
                        className="px-3 py-2 rounded-xl border border-white/10 bg-white/0 text-slate-400 text-xs font-bold hover:bg-white/5 transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nome Completo *</label>
                  <input
                    value={novoNomeCompleto}
                    onChange={(e) => setNovoNomeCompleto(e.target.value)}
                    placeholder="Nome completo do colaborador"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">CPF *</label>
                  <input
                    value={novoCpf}
                    onChange={(e) => setNovoCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data Nascimento *</label>
                  <input
                    type="date"
                    value={novoDataNascimento}
                    onChange={(e) => setNovoDataNascimento(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Email Pessoal *</label>
                  <input
                    type="email"
                    value={novoEmailPessoal}
                    onChange={(e) => setNovoEmailPessoal(e.target.value)}
                    placeholder="exemplo@gmail.com"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Telefone *</label>
                  <input
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Endereço Completo *</label>
                  <input
                    value={novoEndereco}
                    onChange={(e) => setNovoEndereco(e.target.value)}
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">CEP *</label>
                  <input
                    value={novoCep}
                    onChange={(e) => setNovoCep(formatCEP(e.target.value))}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Tab: Corporativo */}
            {currentTab === 'corporativo' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Empresa Correspondente *</label>
                  <select
                    value={novoEmpresaId}
                    onChange={(e) => setNovoEmpresaId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  >
                    <option value="">Selecione...</option>
                    {empresas.map((e) => (
                      <option key={e.empresa_id} value={e.empresa_id}>
                        {e.nome_fantasia || e.razao_social}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data Admissão *</label>
                  <input
                    type="date"
                    value={novoDataAdmissao}
                    onChange={(e) => setNovoDataAdmissao(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Matrícula *</label>
                  <input
                    value={novoMatricula}
                    onChange={(e) => setNovoMatricula(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Departamento *</label>
                  <select
                    value={novoDepartamento}
                    onChange={(e) => setNovoDepartamento(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  >
                    <option value="">Selecione...</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Produção">Produção</option>
                    <option value="Logística">Logística</option>
                    <option value="TI">TI</option>
                    <option value="RH">RH</option>
                    <option value="Diretoria">Diretoria</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Email Corporativo</label>
                  <input
                    type="email"
                    value={novoEmailCorporativo}
                    onChange={(e) => setNovoEmailCorporativo(e.target.value)}
                    placeholder="email@empresa.com.br"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Ramal</label>
                  <input
                    value={novoRamal}
                    onChange={(e) => setNovoRamal(e.target.value)}
                    placeholder="Ex: 1234"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Tab: Acesso */}
            {currentTab === 'acesso' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                {!completarUsuario ? (
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <UserPlus size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Criar Acesso ao Sistema</h4>
                        <p className="text-xs text-slate-400">Um novo usuário será criado com as credenciais abaixo.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Email de Login *</label>
                        <input
                          type="email"
                          value={novoAcessoEmail}
                          onChange={(e) => setNovoAcessoEmail(e.target.value)}
                          placeholder="login@email.com"
                          className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Senha Inicial *</label>
                        <input
                          type="text"
                          value={novoAcessoSenha}
                          onChange={(e) => setNovoAcessoSenha(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Perfil de Acesso *</label>
                        <select
                          value={novoAcessoPerfilId}
                          onChange={(e) => setNovoAcessoPerfilId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                        >
                          <option value="">Selecione...</option>
                          {perfis.map(p => (
                            <option key={p.perfil_id} value={p.perfil_id}>{p.perfil_nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Usuário já criado</h4>
                        <p className="text-xs text-slate-400">Complete os dados do colaborador e salve.</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0B1220] border border-white/10 flex items-center gap-3">
                      <Avatar nome={completarUsuario.nome} avatarUrl={completarUsuario.avatar_url} size={40} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate">{completarUsuario.nome}</div>
                        <div className="text-xs text-slate-500 truncate">{completarUsuario.email_login}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Detalhes (Mantido igual, só lendo do activeColaborador) */}
      <Modal
        isOpen={isDetalheOpen}
        onClose={() => setIsDetalheOpen(false)}
        title="Detalhes do Colaborador"
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
              onClick={openEditar}
              disabled={!activeColaborador}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Editar Dados
            </button>
            <button
              type="button"
              onClick={openResetSenha}
              disabled={!activeColaborador}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Resetar Senha
            </button>
            {activeColaborador?.usuario.ativo === false ? (
              <button
                type="button"
                onClick={handleReativar}
                disabled={!activeColaborador || changingStatus}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {changingStatus ? 'Reativando...' : 'Reativar Usuário'}
              </button>
            ) : (
              <button
                type="button"
                onClick={openDesativar}
                disabled={!activeColaborador || changingStatus}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Desativar Usuário
              </button>
            )}
            <button
              type="button"
              onClick={openDocumento}
              disabled={!activeColaborador}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FilePlus size={16} />
              Adicionar Documento
            </button>
          </>
        }
      >
        {!activeColaborador ? (
          <div className="text-sm text-slate-400">Selecione um colaborador.</div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar nome={activeColaborador.usuario.nome} avatarUrl={activeColaborador.usuario.avatar_url} size={64} />
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-white truncate">{activeColaborador.usuario.nome}</div>
                <div className="text-sm text-slate-400 truncate">{activeColaborador.usuario.cargo || activeColaborador.departamento || '—'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-full">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Dados Pessoais</h4>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome Completo</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.nomeCompleto}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">CPF</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.cpf}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data Nascimento</div>
                <div className="text-sm text-slate-200 mt-1">{formatDateBR(activeColaborador.dataNascimento)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Pessoal</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.emailPessoal}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Telefone</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.telefone}</div>
              </div>
              <div className="col-span-full rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Endereço</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.enderecoCompleto} - CEP: {activeColaborador.cep}</div>
              </div>

              <div className="col-span-full mt-2">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Contato Corporativo</h4>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Empresa</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.empresaNome}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Departamento</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.departamento}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Matrícula</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.matricula}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data Admissão</div>
                <div className="text-sm text-slate-200 mt-1">{formatDateBR(activeColaborador.dataAdmissao)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Corporativo</div>
                <div className="text-sm text-slate-200 mt-1">{activeColaborador.usuario.email_corporativo || '—'}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Usuario Sistema</div>
                <div className="text-sm text-slate-200 mt-1 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${activeColaborador.usuario.ativo === false ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  {activeColaborador.usuario.email_login}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Situação</div>
                <div className="text-sm text-slate-200 mt-1 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${activeColaborador.usuario.ativo === false ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  {activeColaborador.usuario.ativo === false ? 'Desativado' : 'Ativo'}
                </div>
              </div>
              {activeColaborador.usuario.ativo === false && (
                <div className="col-span-full rounded-xl border border-white/10 bg-[#0B1220] p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Demissão</div>
                  <div className="text-sm text-slate-200 mt-1">
                    {[activeColaborador.dataDemissao ? `Data: ${formatDateBR(activeColaborador.dataDemissao)}` : null, activeColaborador.obsDemissao ? `Obs: ${activeColaborador.obsDemissao}` : null]
                      .filter(Boolean)
                      .join(' • ') || '—'}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-5 mt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-200">Documentos</div>
                <div className="text-xs text-slate-500">{activeColaborador.docsLoaded ? activeColaborador.documentos.length : '...'}</div>
              </div>
              {!activeColaborador.docsLoaded ? (
                <div className="mt-3 text-sm text-slate-500">Carregando documentos...</div>
              ) : activeColaborador.documentos.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Nenhum documento adicionado.</div>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                  <table className="min-w-full text-left">
                    <thead className="bg-white/5">
                      <tr className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3 whitespace-nowrap">Emissão</th>
                        <th className="px-4 py-3 whitespace-nowrap">Vencimento</th>
                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-white/0">
                      {activeColaborador.documentos.map((d) => {
                        const isAtivo = activeColaborador.usuario.ativo !== false
                        const vencido = isAtivo && isVencido(d.dataVencimento)
                        const vencendo = isAtivo && isVencendo(d.dataVencimento)
                        const statusDoc = vencido ? 'Inválido' : 'Válido'
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
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">
                              {d.dataEmissao ? formatDateBR(d.dataEmissao) : '—'}
                            </td>
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
                            <td className="px-4 py-3 whitespace-nowrap">
                              {statusDoc === 'Inválido' ? (
                                <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 text-[11px] font-bold uppercase tracking-wider border border-orange-500/20">
                                  Inválido
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[11px] font-bold uppercase tracking-wider border border-emerald-500/20">
                                  Válido
                                </span>
                              )}
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

      {/* Modal Reset Senha */}
      <Modal
        isOpen={isResetSenhaOpen}
        onClose={() => setIsResetSenhaOpen(false)}
        title="Resetar Senha"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsResetSenhaOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmResetSenha}
              disabled={resettingSenha}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-60"
            >
              {resettingSenha ? 'Resetando...' : 'Confirmar Reset'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {resetSenhaError && <div className="text-rose-400 text-xs">{resetSenhaError}</div>}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nova Senha</label>
            <input
              type="password"
              value={resetSenha}
              onChange={(e) => setResetSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Desativar */}
      <Modal
        isOpen={isDesativarOpen}
        onClose={() => setIsDesativarOpen(false)}
        title="Desativar Colaborador"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDesativarOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDesativar}
              disabled={changingStatus}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-60"
            >
              {changingStatus ? 'Desativando...' : 'Confirmar Desativação'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-xs text-rose-200">
            Atenção: O usuário perderá o acesso ao sistema imediatamente.
          </div>
          {desativarError && <div className="text-rose-400 text-xs">{desativarError}</div>}
          
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data da Demissão *</label>
            <input
              type="date"
              value={demissaoData}
              onChange={(e) => setDemissaoData(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/25 transition-all"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Observação / Motivo *</label>
            <textarea
              value={demissaoObs}
              onChange={(e) => setDemissaoObs(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo da demissão..."
              className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/25 transition-all resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={isEditarOpen}
        onClose={() => setIsEditarOpen(false)}
        title="Editar Dados do Colaborador"
        size="3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsEditarOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarEdicao}
              disabled={savingEdit}
              className="px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {editError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              {editError}
            </div>
          )}

          <div className="flex items-center gap-1 border-b border-white/10">
            <button
              onClick={() => setCurrentTab('pessoal')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                currentTab === 'pessoal' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Dados Pessoais
            </button>
            <button
              onClick={() => setCurrentTab('corporativo')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                currentTab === 'corporativo' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Contato Corporativo
            </button>
          </div>

          <div className="min-h-[300px]">
            {/* Tab: Pessoal */}
            {currentTab === 'pessoal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Foto de Perfil</label>
                  <div className="flex items-center gap-3">
                    <Avatar nome={editNomeCompleto || 'Usuário'} avatarUrl={editAvatarPreview || activeColaborador?.usuario.avatar_url || ''} size={48} />
                    <input
                      type="file"
                      id="colab-avatar-edit"
                      accept="image/png,image/jpeg"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        if (!f) { setEditAvatarFile(null); return }
                        if (f.size > 3 * 1024 * 1024) { setEditError('Imagem muito grande (máx 3MB).'); setEditAvatarFile(null); return }
                        if (f.type !== 'image/png' && f.type !== 'image/jpeg') { setEditError('Formato inválido. Use PNG ou JPEG.'); setEditAvatarFile(null); return }
                        setEditAvatarFile(f)
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="colab-avatar-edit"
                      className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Selecionar foto
                    </label>
                    {editAvatarFile && (
                      <button
                        type="button"
                        onClick={() => setEditAvatarFile(null)}
                        className="px-3 py-2 rounded-xl border border-white/10 bg-white/0 text-slate-400 text-xs font-bold hover:bg-white/5 transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nome Completo *</label>
                  <input
                    value={editNomeCompleto}
                    onChange={(e) => setEditNomeCompleto(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">CPF *</label>
                  <input
                    value={editCpf}
                    onChange={(e) => setEditCpf(formatCPF(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data Nascimento *</label>
                  <input
                    type="date"
                    value={editDataNascimento}
                    onChange={(e) => setEditDataNascimento(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Email Pessoal *</label>
                  <input
                    type="email"
                    value={editEmailPessoal}
                    onChange={(e) => setEditEmailPessoal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Telefone *</label>
                  <input
                    value={editTelefone}
                    onChange={(e) => setEditTelefone(formatPhone(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Endereço Completo *</label>
                  <input
                    value={editEndereco}
                    onChange={(e) => setEditEndereco(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">CEP *</label>
                  <input
                    value={editCep}
                    onChange={(e) => setEditCep(formatCEP(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Tab: Corporativo */}
            {currentTab === 'corporativo' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Empresa Correspondente *</label>
                  <select
                    value={editEmpresaId}
                    onChange={(e) => setEditEmpresaId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  >
                    <option value="">Selecione...</option>
                    {empresas.map((e) => (
                      <option key={e.empresa_id} value={e.empresa_id}>
                        {e.nome_fantasia || e.razao_social}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data Admissão *</label>
                  <input
                    type="date"
                    value={editDataAdmissao}
                    onChange={(e) => setEditDataAdmissao(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Matrícula *</label>
                  <input
                    value={editMatricula}
                    onChange={(e) => setEditMatricula(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Departamento *</label>
                  <select
                    value={editDepartamento}
                    onChange={(e) => setEditDepartamento(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  >
                    <option value="">Selecione...</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Produção">Produção</option>
                    <option value="Logística">Logística</option>
                    <option value="TI">TI</option>
                    <option value="RH">RH</option>
                    <option value="Diretoria">Diretoria</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Email Corporativo</label>
                  <input
                    type="email"
                    value={editEmailCorporativo}
                    onChange={(e) => setEditEmailCorporativo(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Ramal</label>
                  <input
                    value={editRamal}
                    onChange={(e) => setEditRamal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                
                <div className="col-span-full pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Key size={16} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acesso ao Sistema</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email de Login (Não editável)</label>
                    <div className="text-sm text-slate-300 mt-1 font-mono">{activeColaborador?.usuario.email_login}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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

      {/* Modal Adicionar Documento */}
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
              onClick={async () => {
                if (savingDocRef.current) return
                if (!docNome) { setDocError('Informe o nome.'); return }
                if (!docFile) { setDocError('Selecione um arquivo.'); return }
                if (!activeId) return
                
                try {
                  setSavingDoc(true)
                  savingDocRef.current = true
                  const fileExt = docFile.name.split('.').pop()
                  const fileName = `${activeId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
                  
                  const { error: uploadError } = await supabase.storage
                    .from('colaboradores-docs')
                    .upload(fileName, docFile)

                  if (uploadError) {
                    const msg = String(uploadError?.message || '')
                    if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not found')) {
                      throw new Error("Bucket 'colaboradores-docs' não existe no Storage. Crie o bucket ou aplique a migration 20260219_add_colab_docs_fields.sql.")
                    }
                    throw uploadError
                  }

                  const { data: { publicUrl } } = supabase.storage
                    .from('colaboradores-docs')
                    .getPublicUrl(fileName)

                  const { data: newDoc, error } = await supabase
                    .from('colaboradores_documentos')
                    .insert({
                      colaborador_id: activeId,
                      nome: docNome,
                      arquivo_nome: docFile.name,
                      arquivo_url: publicUrl,
                      data_emissao: docEmissao || null,
                      data_vencimento: docVencimento || null
                    })
                    .select()
                    .single()

                  if (error) {
                    if (isMissingTable(error)) {
                      throw new Error(
                        "Tabela 'colaboradores_documentos' ainda não foi criada no banco. Aplique a migration 20260218_create_colaboradores.sql e recarregue o schema cache do Supabase."
                      )
                    }
                    throw error
                  }

                  setColaboradores(prev => prev.map(c => c.id === activeId ? {
                    ...c,
                    docsLoaded: true,
                    documentos: [{ 
                        id: newDoc.id, 
                        nome: newDoc.nome, 
                        arquivoNome: newDoc.arquivo_nome, 
                        arquivoUrl: newDoc.arquivo_url,
                        dataEmissao: newDoc.data_emissao,
                        dataVencimento: newDoc.data_vencimento,
                        createdAt: newDoc.created_at 
                    }, ...c.documentos]
                  } : c))
                  try {
                    await refreshDocsVencendo(activeId)
                  } catch (e) {
                    console.error(e)
                  }
                  
                  setIsDocumentoOpen(false)
                  setIsDetalheOpen(true)
                  setDocNome('')
                  setDocFile(null)
                  setDocEmissao('')
                  setDocVencimento('')
                  setDocError(null)
                } catch (err: any) {
                  setDocError(err.message || 'Erro ao salvar documento.')
                } finally {
                  setSavingDoc(false)
                  savingDocRef.current = false
                }
              }}
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
            <input value={docNome} onChange={e => setDocNome(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data de Emissão</label>
               <input type="date" value={docEmissao} onChange={e => setDocEmissao(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all" />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data de Vencimento</label>
               <input type="date" value={docVencimento} onChange={e => setDocVencimento(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Arquivo</label>
            <div className="relative group">
                <input 
                  type="file" 
                  id="doc-file-upload"
                  onChange={e => setDocFile(e.target.files?.[0] || null)} 
                  className="hidden" 
                />
                <label 
                  htmlFor="doc-file-upload" 
                  className="flex items-center justify-center gap-2 w-full px-3 py-4 rounded-xl bg-[#0B1220] border border-dashed border-white/20 text-sm text-slate-400 cursor-pointer hover:border-cyan-500/50 hover:bg-white/5 transition-all"
                >
                  <Upload size={16} />
                  {docFile ? <span className="text-cyan-400 font-medium">{docFile.name}</span> : <span>Clique para selecionar um arquivo</span>}
                </label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
