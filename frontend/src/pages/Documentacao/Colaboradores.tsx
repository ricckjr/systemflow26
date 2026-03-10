import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, FilePlus, Calendar, Building2, UserPlus, Info, AlertTriangle, Download, Trash2, Upload, Key } from 'lucide-react'
import { Modal } from '@/components/ui'
import { fetchFinEmpresasCorrespondentes, FinEmpresaCorrespondente } from '@/services/financeiro'

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

type UsuarioSistema = {
  id: string
  nome: string
  avatar_url?: string | null
  email_corporativo?: string | null
  email_login?: string | null
  ramal?: string | null
}

type Colaborador = {
  id: string
  empresaId: string
  empresaNome: string
  usuarioId: string
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
  obsGerais?: string | null
  createdAt: string
}

// --- Helpers ---

const ALERTA_VENCIMENTO_DIAS = 30

function makeId(prefix: string) {
  const uuid = (globalThis.crypto as any)?.randomUUID?.()
  return `${prefix}_${uuid ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`
}

function formatDateBR(dateISO: string) {
  if (!dateISO) return '-'
  const s = dateISO.includes('T') ? dateISO.slice(0, 10) : dateISO
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return dateISO
  return `${d}/${m}/${y}`
}

function isoToBR(iso: string) {
  const s = String(iso || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function formatBRInput(v: string) {
  const s = String(v || '').replace(/\D/g, '').substring(0, 8)
  const dd = s.slice(0, 2)
  const mm = s.slice(2, 4)
  const yyyy = s.slice(4, 8)
  if (s.length <= 2) return dd
  if (s.length <= 4) return `${dd}/${mm}`
  return `${dd}/${mm}/${yyyy}`
}

function brToISO(br: string) {
  const raw = String(br || '').trim()
  if (!raw) return null
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2])
  const y = Number(m[3])
  if (!d || !mo || !y) return null
  const dt = new Date(y, mo - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatCPF(v: string) {
  v = v.replace(/\D/g, '')
  if (v.length <= 11) {
    v = v.substring(0, 11)
    return v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  if (v.length > 14) v = v.substring(0, 14)
  return v
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
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

function getTodayPartsInTimeZone(timeZone: string) {
  const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = fmt.formatToParts(new Date())
  const dd = Number(parts.find((p) => p.type === 'day')?.value)
  const mm = Number(parts.find((p) => p.type === 'month')?.value)
  const yyyy = Number(parts.find((p) => p.type === 'year')?.value)
  if (!dd || !mm || !yyyy) return null
  return { yyyy, mm, dd }
}

function addDaysISOFromParts(parts: { yyyy: number; mm: number; dd: number }, daysAhead: number) {
  const baseUTC = Date.UTC(parts.yyyy, parts.mm - 1, parts.dd)
  const ms = baseUTC + daysAhead * 24 * 60 * 60 * 1000
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateToUTC(dateValue: string) {
  const raw = String(dateValue || '').trim()
  if (!raw) return null
  const s = raw.includes('T') ? raw.slice(0, 10) : raw
  let y: number | null = null
  let m: number | null = null
  let d: number | null = null
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
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const parts = s.split('-').map(Number)
    d = parts[0]
    m = parts[1]
    y = parts[2]
  }
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return Date.UTC(y, m - 1, d)
}

function getDiffDaysToVencimento(dataVencimento?: string | null) {
  const vencUTC = parseDateToUTC(String(dataVencimento || ''))
  if (vencUTC === null) return false
  const todayParts = getTodayPartsInTimeZone('America/Sao_Paulo')
  if (!todayParts) return false
  const hojeUTC = Date.UTC(todayParts.yyyy, todayParts.mm - 1, todayParts.dd)
  const diffDays = Math.ceil((vencUTC - hojeUTC) / (1000 * 60 * 60 * 24))
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

function DateBRPicker({
  valueISO,
  onChangeISO,
}: {
  valueISO: string
  onChangeISO: (nextISO: string) => void
}) {
  const idRef = useRef(makeId('date'))
  const hiddenRef = useRef<HTMLInputElement | null>(null)
  const [text, setText] = useState(() => (valueISO ? isoToBR(valueISO) : ''))

  useEffect(() => {
    setText(valueISO ? isoToBR(valueISO) : '')
  }, [valueISO])

  return (
    <div className="relative">
      <input
        id={idRef.current}
        value={text}
        onChange={(e) => {
          const next = formatBRInput(e.target.value)
          setText(next)
          if (!next) {
            onChangeISO('')
            return
          }
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(next)) {
            const iso = brToISO(next)
            if (iso) onChangeISO(iso)
          } else {
            onChangeISO('')
          }
        }}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        className="w-full px-3 pr-11 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
      />
      <button
        type="button"
        onClick={() => {
          const el = hiddenRef.current as any
          if (!el) return
          if (typeof el.showPicker === 'function') el.showPicker()
          else el.click?.()
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/5 transition-colors text-slate-400 hover:text-slate-200"
        aria-label="Abrir calendário"
      >
        <Calendar size={16} />
      </button>
      <input
        ref={hiddenRef}
        type="date"
        lang="pt-BR"
        value={valueISO}
        onChange={(e) => onChangeISO(e.target.value)}
        className="absolute -z-10 opacity-0 w-0 h-0"
      />
    </div>
  )
}

// --- Página Principal ---

export default function Colaboradores() {
  const sb = supabase as any
  const [allUsers, setAllUsers] = useState<UsuarioSistema[]>([])
  
  const [empresas, setEmpresas] = useState<FinEmpresaCorrespondente[]>([])
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
  const [detalheTab, setDetalheTab] = useState<'pessoal' | 'documentacao'>('pessoal')
  const activeColaborador = useMemo(() => colaboradores.find((c) => c.id === activeId) ?? null, [activeId, colaboradores])

  // --- Form Novo Colaborador ---
  const [editTab, setEditTab] = useState<'pessoal' | 'corporativo'>('pessoal')
  
  // Dados Pessoais
  const [novoNomeCompleto, setNovoNomeCompleto] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [novoDataNascimento, setNovoDataNascimento] = useState('')
  const [novoEmailPessoal, setNovoEmailPessoal] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [novoCep, setNovoCep] = useState('')
  const [novoDataDemissao, setNovoDataDemissao] = useState('')
  const [novoObsGerais, setNovoObsGerais] = useState('')

  // Dados Corporativos
  const [novoEmpresaId, setNovoEmpresaId] = useState('')
  const [novoMatricula, setNovoMatricula] = useState('')
  const [novoDepartamento, setNovoDepartamento] = useState('')
  const [novoDataAdmissao, setNovoDataAdmissao] = useState('')
  const [novoEmailCorporativo, setNovoEmailCorporativo] = useState('')
  const [novoRamal, setNovoRamal] = useState('')

  const [completarUsuario, setCompletarUsuario] = useState<UsuarioSistema | null>(null)

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
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const editInitialRef = useRef<null | {
    nomeCompleto: string
    cpf: string
    dataNascimento: string
    emailPessoal: string
    telefone: string
    endereco: string
    cep: string
    empresaId: string
    matricula: string
    departamento: string
    dataAdmissao: string
    emailCorporativo: string
    ramal: string
  }>(null)

  // --- Loads ---

  useEffect(() => {
    let mounted = true
    async function loadData() {
      try {
        setLoadingInit(true)

        const { data: colabData, error: colabError } = await sb
          .from('colaboradores')
          .select(`
            *,
            empresa:fin_empresas_correspondentes(nome_fantasia, razao_social)
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
            usuarioId: c.user_id,
            usuario: {
              id: c.user_id,
              nome: c.nome_completo,
              avatar_url: null,
              email_corporativo: c.email_corporativo,
              ramal: c.ramal,
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
            obsGerais: c.obs_gerais,
            createdAt: c.created_at
          }))
          const userIds = Array.from(new Set(mappedColabs.map((c) => String(c.usuarioId || '')).filter(Boolean)))
          if (userIds.length > 0) {
            const { data: profs, error: profErr } = await supabase
              .from('profiles_public')
              .select('id, nome, avatar_url')
              .in('id', userIds)
            if (!profErr) {
              const map: Record<string, any> = {}
              ;(profs ?? []).forEach((p: any) => { map[String(p.id)] = p })
              const merged = mappedColabs.map((c) => {
                const p = map[String(c.usuarioId)]
                if (!p) return c
                return {
                  ...c,
                  usuario: {
                    ...c.usuario,
                    nome: String(p.nome || c.usuario.nome || ''),
                    avatar_url: p.avatar_url || null
                  }
                }
              })
              setColaboradores(merged)
            } else {
              setColaboradores(mappedColabs)
            }
          } else {
            setColaboradores(mappedColabs)
          }
        }

        const todayParts = getTodayPartsInTimeZone('America/Sao_Paulo')
        const limiteISO = todayParts
          ? addDaysISOFromParts(todayParts, ALERTA_VENCIMENTO_DIAS)
          : (() => {
            const hoje = new Date()
            hoje.setHours(0, 0, 0, 0)
            const limite = new Date(hoje)
            limite.setDate(limite.getDate() + ALERTA_VENCIMENTO_DIAS)
            return `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`
          })()

        ;(async () => {
          try {
            const { data, error } = await sb
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
            const [empresasData, usersData] = await Promise.all([
              fetchFinEmpresasCorrespondentes(),
              supabase
                .from('profiles_public')
                .select('id, nome, avatar_url')
                .order('nome', { ascending: true })
                .limit(1000)
            ])

            if (!mounted) return
            setEmpresas((empresasData ?? []).filter((e) => e.ativo))

            const profResp: any = usersData
            if (profResp?.error) throw profResp.error
            setAllUsers((profResp?.data ?? []).map((p: any) => ({ id: p.id, nome: p.nome, avatar_url: p.avatar_url })))
          } catch (e: any) {
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

  const editDirty = useMemo(() => {
    if (!isEditarOpen) return false
    const init = editInitialRef.current
    if (!init) return false
    if (editNomeCompleto !== init.nomeCompleto) return true
    if (editCpf !== init.cpf) return true
    if (editDataNascimento !== init.dataNascimento) return true
    if (editEmailPessoal !== init.emailPessoal) return true
    if (editTelefone !== init.telefone) return true
    if (editEndereco !== init.endereco) return true
    if (editCep !== init.cep) return true
    if (editEmpresaId !== init.empresaId) return true
    if (editMatricula !== init.matricula) return true
    if (editDepartamento !== init.departamento) return true
    if (editDataAdmissao !== init.dataAdmissao) return true
    if (editEmailCorporativo !== init.emailCorporativo) return true
    if (editRamal !== init.ramal) return true
    return false
  }, [
    editCep,
    editCpf,
    editDataAdmissao,
    editDataNascimento,
    editDepartamento,
    editEmailCorporativo,
    editEmailPessoal,
    editEmpresaId,
    editEndereco,
    editMatricula,
    editNomeCompleto,
    editRamal,
    editTelefone,
    isEditarOpen,
  ])

  const filteredColaboradores = useMemo(() => {
    const q = search.trim().toLowerCase()
    return colaboradores
      .filter((c) => (statusFilter === 'ativos' ? !c.dataDemissao : !!c.dataDemissao))
      .filter((c) => {
        if (!q) return true
        const nome = String(c.nomeCompleto || '').toLowerCase()
        const dep = String(c.departamento || '').toLowerCase()
        const empresaNome = String(c.empresaNome || '').toLowerCase()
        return nome.includes(q) || dep.includes(q) || empresaNome.includes(q)
      })
  }, [colaboradores, search, statusFilter])

  // --- Actions ---

  const refreshDocsVencendo = async (colaboradorId?: string) => {
    const todayParts = getTodayPartsInTimeZone('America/Sao_Paulo')
    const limiteISO = todayParts
      ? addDaysISOFromParts(todayParts, ALERTA_VENCIMENTO_DIAS)
      : (() => {
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        const limite = new Date(hoje)
        limite.setDate(limite.getDate() + ALERTA_VENCIMENTO_DIAS)
        return `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`
      })()

    let query = sb
      .from('colaboradores_documentos')
      .select('colaborador_id, data_vencimento')
      .lte('data_vencimento', limiteISO)
      .not('data_vencimento', 'is', null)

    if (colaboradorId) query = query.eq('colaborador_id', colaboradorId)

    const { data, error } = await query
    if (error) {
      const msg = String((error as any)?.message || '').toLowerCase()
      if (msg.includes('data_vencimento') && msg.includes('does not exist')) return
      throw error
    }

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

    let data: any[] | null = null
    let error: any = null

    ;({ data, error } = await sb
      .from('colaboradores_documentos')
      .select('id, nome, arquivo_nome, arquivo_url, data_emissao, data_vencimento, created_at')
      .eq('colaborador_id', colaboradorId)
      .order('created_at', { ascending: false }))

    if (error) {
      const msg = String(error?.message || '').toLowerCase()
      if (msg.includes('data_emissao') && msg.includes('does not exist')) {
        ;({ data, error } = await sb
          .from('colaboradores_documentos')
          .select('id, nome, arquivo_nome, arquivo_url, created_at')
          .eq('colaborador_id', colaboradorId)
          .order('created_at', { ascending: false }))
      } else if (msg.includes('data_vencimento') && msg.includes('does not exist')) {
        ;({ data, error } = await sb
          .from('colaboradores_documentos')
          .select('id, nome, arquivo_nome, arquivo_url, created_at')
          .eq('colaborador_id', colaboradorId)
          .order('created_at', { ascending: false }))
      }
    }

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

  const openDetalhe = (colaboradorId: string, tab: 'pessoal' | 'documentacao' = 'pessoal') => {
    setActiveId(colaboradorId)
    setDetalheTab(tab)
    setIsDetalheOpen(true)
    void ensureDocsLoaded(colaboradorId)
  }

  const openNovo = () => {
    // Reset Form
    setCompletarUsuario(null)
    setNovoNomeCompleto('')
    setNovoCpf('')
    setNovoDataNascimento('')
    setNovoEmailPessoal('')
    setNovoTelefone('')
    setNovoEndereco('')
    setNovoCep('')
    setNovoDataDemissao('')
    setNovoObsGerais('')
    
    setNovoEmpresaId('')
    setNovoMatricula('')
    setNovoDepartamento('')
    setNovoDataAdmissao('')
    setNovoEmailCorporativo('')
    setNovoRamal('')

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

  const openEditar = () => {
    if (!activeColaborador) return
    setEditTab('pessoal')
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
    editInitialRef.current = {
      nomeCompleto: activeColaborador.nomeCompleto,
      cpf: activeColaborador.cpf,
      dataNascimento: activeColaborador.dataNascimento,
      emailPessoal: activeColaborador.emailPessoal,
      telefone: activeColaborador.telefone,
      endereco: activeColaborador.enderecoCompleto,
      cep: activeColaborador.cep,
      empresaId: activeColaborador.empresaId,
      matricula: activeColaborador.matricula,
      departamento: activeColaborador.departamento,
      dataAdmissao: activeColaborador.dataAdmissao,
      emailCorporativo: activeColaborador.usuario.email_corporativo || '',
      ramal: activeColaborador.usuario.ramal || '',
    }
    setEditError(null)
    setIsEditarOpen(true)
  }

  const handleSave = async () => {
    setNovoError(null)
    setSaving(true)

    try {
      if (!completarUsuario) {
        throw new Error('Selecione o usuário do sistema.')
      }
      if (colaboradoresByUserId[completarUsuario.id]) {
        throw new Error('Este usuário já possui cadastro de colaborador.')
      }

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

      const usuarioFinal = completarUsuario
      const empresa = empresas.find(e => e.empresa_id === novoEmpresaId)
      
      const payloadColaboradorBase: any = {
        user_id: usuarioFinal.id,
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
        ramal: novoRamal || null,
        data_demissao: novoDataDemissao || null,
        obs_gerais: novoObsGerais || null
      }

      const tryInsertColaborador = async (payload: any) => {
        return await sb.from('colaboradores').insert(payload).select().single()
      }

      let createdColab: any = null
      let createError: any = null

      ;({ data: createdColab, error: createError } = await tryInsertColaborador(payloadColaboradorBase))

      if (createError) {
        const msg = String(createError?.message || '').toLowerCase()
        if (msg.includes('data_demissao') && msg.includes('does not exist')) {
          const { data, error } = await tryInsertColaborador((({ data_demissao, ...rest }) => rest)(payloadColaboradorBase))
          createdColab = data
          createError = error
        } else if (msg.includes('obs_gerais') && msg.includes('does not exist')) {
          const { data, error } = await tryInsertColaborador((({ obs_gerais, ...rest }) => rest)(payloadColaboradorBase))
          createdColab = data
          createError = error
        }
      }

      if (createError) {
        if (isMissingTable(createError)) {
          throw new Error(
            "Tabela 'colaboradores' ainda não foi criada no banco. Aplique a migration 20260218_create_colaboradores.sql e recarregue o schema cache do Supabase."
          )
        }
        const msg = String((createError as any)?.message || '').toLowerCase()
        if (msg.includes('data_demissao') && msg.includes('does not exist')) {
          throw new Error(
            "Campo 'data_demissao' ainda não existe no banco. Aplique a migration 20260219_add_colaboradores_demissao_fields.sql e recarregue o schema cache do Supabase."
          )
        }
        if (msg.includes('obs_gerais') && msg.includes('does not exist')) {
          throw new Error(
            "Campo 'obs_gerais' ainda não existe no banco. Aplique a migration 20260219_add_colaboradores_obs_gerais.sql e recarregue o schema cache do Supabase."
          )
        }
        throw new Error(createError.message || 'Erro ao salvar colaborador no banco.')
      }

      const novoColaborador: Colaborador = {
        id: createdColab.id,
        empresaId: novoEmpresaId,
        empresaNome: empresa?.nome_fantasia || 'Empresa',
        usuarioId: usuarioFinal.id,
        usuario: {
          ...usuarioFinal!,
          email_corporativo: novoEmailCorporativo || null,
          ramal: novoRamal || null
        },
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
        dataDemissao: novoDataDemissao || null,
        obsGerais: novoObsGerais || null,
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

      const { data: updated, error: upErr } = await sb
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
      const { error } = await sb.from('colaboradores_documentos').delete().eq('id', docId)
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
      try {
        window.dispatchEvent(new Event('systemflow:refreshAdminDocsAlert'))
      } catch {}
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
          <p className="text-sm text-industrial-text-secondary">Cadastro de colaboradores</p>
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
            placeholder="Buscar por nome, departamento ou empresa..."
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
      {loadingInit || loadingAux ? (
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
      ) : filteredColaboradores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <UserPlus size={32} className="text-slate-500" />
          </div>
          <p className="text-base font-semibold text-slate-200">Nenhum colaborador encontrado</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">Clique em “Novo Colaborador” para cadastrar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredColaboradores.map((colab) => {
            const isAtivo = !colab.dataDemissao
            const statusLoaded = colab.docsLoaded
              ? colab.documentos.reduce<DocAlertStatus | null>((acc, d) => mergeDocAlertStatus(acc, getDocAlertStatus(d.dataVencimento)), null)
              : null
            const docAlert = isAtivo ? mergeDocAlertStatus(docsAlertaMap[colab.id], statusLoaded) : null
            const openCard = () => openDetalhe(colab.id)
            return (
            <div
              key={colab.id}
              role="button"
              tabIndex={0}
              onClick={openCard}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openCard()
              }}
              className="text-left rounded-2xl border border-white/10 bg-[#0F172A] p-5 hover:border-cyan-500/30 hover:bg-[#0B1220] transition-colors group relative cursor-pointer outline-none focus:ring-2 focus:ring-cyan-500/25"
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
                <Avatar nome={colab.nomeCompleto} avatarUrl={colab.usuario.avatar_url} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100 truncate group-hover:text-cyan-400 transition-colors">{colab.nomeCompleto}</div>
                  <div className="text-xs text-slate-400 truncate">{colab.departamento || '—'}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Building2 size={14} className="text-slate-500" />
                  <span className="truncate">{colab.empresaNome || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Calendar size={14} className="text-slate-500" />
                  <span>Admissão: {colab.dataAdmissao ? formatDateBR(colab.dataAdmissao) : '—'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-500">{colab.docsLoaded ? `${colab.documentos.length} documentos` : '— documentos'}</span>
                </div>
                {colab.dataDemissao ? <span className="text-rose-400 font-medium">Desativado</span> : <span className="text-emerald-400 font-medium">Ativo</span>}
              </div>
            </div>
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
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-2"
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

          <div className="min-h-[300px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Usuário do Sistema *</label>
                  <select
                    value={completarUsuario?.id || ''}
                    onChange={(e) => {
                      const id = e.target.value
                      const u = allUsers.find((x) => x.id === id) || null
                      setCompletarUsuario(u)
                      if (!u) return
                      if (!novoNomeCompleto) setNovoNomeCompleto(u.nome || '')
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  >
                    <option value="">Selecione...</option>
                    {allUsers.map((u) => {
                      const jaCadastrado = !!colaboradoresByUserId[u.id]
                      return (
                        <option key={u.id} value={u.id} disabled={jaCadastrado}>
                          {u.nome}{jaCadastrado ? ' (já cadastrado)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
                {completarUsuario ? (
                  <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
                    <Avatar nome={completarUsuario.nome} avatarUrl={completarUsuario.avatar_url} size={44} />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-100 truncate">{completarUsuario.nome}</div>
                      <div className="text-xs text-slate-500 truncate">{completarUsuario.id}</div>
                    </div>
                  </div>
                ) : null}
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
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">CPF ou CNPJ *</label>
                  <input
                    value={novoCpf}
                    onChange={(e) => setNovoCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    maxLength={18}
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
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Matrícula *</label>
                  <input
                    value={novoMatricula}
                    onChange={(e) => setNovoMatricula(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
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
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Departamento *</label>
                  <input
                    value={novoDepartamento}
                    onChange={(e) => setNovoDepartamento(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Observações Gerais</label>
                  <textarea
                    value={novoObsGerais}
                    onChange={(e) => setNovoObsGerais(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
              </div>
          </div>
        </div>
      </Modal>

      {/* Modal Detalhes (Mantido igual, só lendo do activeColaborador) */}
      <Modal
        isOpen={isDetalheOpen}
        onClose={() => setIsDetalheOpen(false)}
        title="Detalhes do Colaborador"
        size="full"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDetalheOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Fechar
            </button>
          </>
        }
      >
        {!activeColaborador ? (
          <div className="text-sm text-slate-400">Selecione um colaborador.</div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar nome={activeColaborador.nomeCompleto} avatarUrl={activeColaborador.usuario.avatar_url} size={64} />
              <div className="min-w-0">
                <div className="text-lg font-extrabold text-white truncate">{activeColaborador.nomeCompleto}</div>
                <div className="text-sm text-slate-400 truncate">{activeColaborador.departamento || '—'}</div>
              </div>
            </div>

            <div className="flex items-center gap-1 border-b border-white/10">
              <button
                type="button"
                onClick={() => setDetalheTab('pessoal')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  detalheTab === 'pessoal' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                Dados Pessoais
              </button>
              <button
                type="button"
                onClick={() => setDetalheTab('documentacao')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  detalheTab === 'documentacao' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                Documentação
              </button>
            </div>

            <div className="min-h-[300px]">
              {detalheTab === 'pessoal' ? (
                <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={openEditar}
                      className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
                    >
                      Editar Informações
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome Completo</div>
                    <div className="text-sm text-slate-200 mt-1">{activeColaborador.nomeCompleto}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">CPF/CNPJ</div>
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
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Empresa Correspondente</div>
                    <div className="text-sm text-slate-200 mt-1">{activeColaborador.empresaNome}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Matrícula</div>
                    <div className="text-sm text-slate-200 mt-1">{activeColaborador.matricula}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Departamento</div>
                    <div className="text-sm text-slate-200 mt-1">{activeColaborador.departamento}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4 md:col-span-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Corporativo</div>
                    <div className="text-sm text-slate-200 mt-1">{activeColaborador.usuario.email_corporativo || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ramal</div>
                    <div className="text-sm text-slate-200 mt-1">{activeColaborador.usuario.ramal || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data Admissão</div>
                    <div className="text-sm text-slate-200 mt-1">{formatDateBR(activeColaborador.dataAdmissao)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data Demissão</div>
                    <div className="text-sm text-slate-200 mt-1">{activeColaborador.dataDemissao ? formatDateBR(activeColaborador.dataDemissao) : '—'}</div>
                  </div>
                  <div className="col-span-full rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações Gerais</div>
                    <div className="text-sm text-slate-200 mt-1 whitespace-pre-wrap">{activeColaborador.obsGerais || '—'}</div>
                  </div>
                  {activeColaborador.dataDemissao && (
                    <div className="col-span-full rounded-xl border border-white/10 bg-[#0B1220] p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observação Demissão</div>
                      <div className="text-sm text-slate-200 mt-1 whitespace-pre-wrap">{activeColaborador.obsDemissao || '—'}</div>
                    </div>
                  )}
                  </div>
                </div>
              ) : detalheTab === 'documentacao' ? (
                <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-5 mt-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-slate-200">Documentos</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-slate-500">{activeColaborador.docsLoaded ? activeColaborador.documentos.length : '...'}</div>
                      <button
                        type="button"
                        onClick={openDocumento}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
                      >
                        <FilePlus size={16} />
                        Adicionar Documento
                      </button>
                    </div>
                  </div>
                  {!activeColaborador.docsLoaded ? (
                    <div className="mt-3 text-sm text-slate-500">Carregando documentos...</div>
                  ) : activeColaborador.documentos.length === 0 ? (
                    <div className="mt-3 text-sm text-slate-500">Nenhum documento adicionado.</div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-white/10 overflow-auto max-h-[60vh]">
                      <table className="min-w-[860px] w-full text-left">
                        <thead className="sticky top-0 z-10 bg-[#0B1220]/95 backdrop-blur border-b border-white/10">
                          <tr className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            <th className="px-4 py-3">Documento</th>
                            <th className="px-4 py-3 whitespace-nowrap">Emissão</th>
                            <th className="px-4 py-3 whitespace-nowrap">Vencimento</th>
                            <th className="px-4 py-3 whitespace-nowrap">Situação</th>
                            <th className="px-4 py-3 text-right whitespace-nowrap">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {activeColaborador.documentos.map((d) => {
                            const isAtivo = !activeColaborador.dataDemissao
                            const vencido = isAtivo && isVencido(d.dataVencimento)
                            const vencendo = isAtivo && isVencendo(d.dataVencimento)
                            const statusDoc = vencido ? 'Inválido' : vencendo ? 'Vencendo' : 'Válido'
                            return (
                              <tr key={d.id} className={vencido ? 'bg-rose-500/5' : vencendo ? 'bg-amber-500/5' : ''}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {vencido ? (
                                      <AlertTriangle size={14} className="text-orange-500 shrink-0" />
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
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {statusDoc === 'Inválido' ? (
                                    <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 text-[11px] font-bold uppercase tracking-wider border border-rose-500/20">
                                      Inválido
                                    </span>
                                  ) : statusDoc === 'Vencendo' ? (
                                    <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-[11px] font-bold uppercase tracking-wider border border-amber-500/20">
                                      Vencendo
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
              ) : null}
            </div>
          </div>
        )}
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
              disabled={savingEdit || !editDirty}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
                editDirty ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-white/10 text-slate-500'
              } disabled:opacity-60`}
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
              type="button"
              onClick={() => setEditTab('pessoal')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                editTab === 'pessoal' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Dados Pessoais
            </button>
            <button
              type="button"
              onClick={() => setEditTab('corporativo')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                editTab === 'corporativo' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Contato Corporativo
            </button>
          </div>

          <div className="min-h-[300px]">
            {/* Tab: Pessoal */}
            {editTab === 'pessoal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nome Completo *</label>
                  <input
                    value={editNomeCompleto}
                    onChange={(e) => setEditNomeCompleto(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">CPF ou CNPJ *</label>
                  <input
                    value={editCpf}
                    onChange={(e) => setEditCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    maxLength={18}
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
            {editTab === 'corporativo' && (
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
                  const isoRe = /^\d{4}-\d{2}-\d{2}$/
                  if (docEmissao && !isoRe.test(docEmissao)) throw new Error('Data de Emissão inválida (DD/MM/AAAA).')
                  if (docVencimento && !isoRe.test(docVencimento)) throw new Error('Data de Vencimento inválida (DD/MM/AAAA).')

                  setSavingDoc(true)
                  savingDocRef.current = true
                  const fileExt = docFile.name.includes('.') ? docFile.name.split('.').pop() : null
                  const finalExt = fileExt || (docFile.type === 'application/pdf' ? 'pdf' : 'bin')
                  const fileName = `${activeId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${finalExt}`
                  
                  const { error: uploadError } = await supabase.storage
                    .from('colaboradores-docs')
                    .upload(fileName, docFile, { contentType: docFile.type || undefined })

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

                  let newDoc: any = null
                  let error: any = null
                  try {
                    ;({ data: newDoc, error } = await sb
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
                      .single())

                    if (error) {
                      const msg = String(error?.message || '').toLowerCase()
                      const missingDateCols =
                        (msg.includes('data_emissao') && msg.includes('does not exist')) ||
                        (msg.includes('data_vencimento') && msg.includes('does not exist'))

                      if (missingDateCols) {
                        ;({ data: newDoc, error } = await sb
                          .from('colaboradores_documentos')
                          .insert({
                            colaborador_id: activeId,
                            nome: docNome,
                            arquivo_nome: docFile.name,
                            arquivo_url: publicUrl
                          })
                          .select()
                          .single())
                      }
                    }
                  } catch (e) {
                    try {
                      await supabase.storage.from('colaboradores-docs').remove([fileName])
                    } catch {
                    }
                    throw e
                  }

                  if (error) {
                    if (isMissingTable(error)) {
                      throw new Error(
                        "Tabela 'colaboradores_documentos' ainda não foi criada no banco. Aplique a migration 20260218_create_colaboradores.sql e recarregue o schema cache do Supabase."
                      )
                    }
                    const msg = String(error?.message || '')
                    if (msg.toLowerCase().includes('data_emissao') && msg.toLowerCase().includes('does not exist')) {
                      throw new Error("Campos de data do documento ainda não existem no banco. Aplique a migration 20260219_add_colab_docs_fields.sql e recarregue o schema cache do Supabase.")
                    }
                    if (msg.toLowerCase().includes('data_vencimento') && msg.toLowerCase().includes('does not exist')) {
                      throw new Error("Campos de data do documento ainda não existem no banco. Aplique a migration 20260219_add_colab_docs_fields.sql e recarregue o schema cache do Supabase.")
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
                  try {
                    window.dispatchEvent(new Event('systemflow:refreshAdminDocsAlert'))
                  } catch {}
                  
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
               <DateBRPicker valueISO={docEmissao} onChangeISO={setDocEmissao} />
            </div>
            <div className="space-y-2">
               <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data de Vencimento</label>
               <DateBRPicker valueISO={docVencimento} onChangeISO={setDocVencimento} />
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
