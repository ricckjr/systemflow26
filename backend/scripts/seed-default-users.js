const crypto = require('crypto')
const { supabaseAdmin } = require('../src/supabase')

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function toAsciiUpper(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function defaultPassword() {
  const provided = process.env.DEFAULT_USERS_PASSWORD
  if (provided) return provided
  return crypto.randomBytes(12).toString('base64url')
}

async function findUserIdByEmail(email) {
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    const found = users.find(u => String(u.email || '').toLowerCase() === String(email).toLowerCase())
    if (found?.id) return found.id
    if (users.length < perPage) return null
    page += 1
  }
}

async function getPerfilIdByNome(perfilNome) {
  const { data, error } = await supabaseAdmin
    .from('perfis')
    .select('perfil_id, perfil_nome')
    .eq('perfil_nome', perfilNome)
    .maybeSingle()
  if (error) throw error
  return data?.perfil_id || null
}

async function ensureAuthUser(email, password, displayName) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: displayName },
  })

  if (!error && data?.user?.id) return data.user.id

  const msg = String(error?.message || '')
  if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
    const existingId = await findUserIdByEmail(email)
    if (!existingId) throw error
    return existingId
  }

  throw error
}

async function upsertProfile(userId, email, nome, cargo) {
  const payload = {
    id: userId,
    nome,
    email_login: email,
    ativo: true,
    cargo,
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
  if (error) throw error
}

async function upsertProfilePerfil(userId, perfilId) {
  const { error } = await supabaseAdmin
    .from('profile_perfis')
    .upsert({ user_id: userId, perfil_id: perfilId }, { onConflict: 'user_id' })
  if (error) throw error
}

async function main() {
  const domain = process.env.DEFAULT_USERS_DOMAIN || 'empresa.local'
  const basePassword = defaultPassword()

  const users = [
    { perfil: 'ADMINISTRADOR', email: `administrador@${domain}`, nome: 'Administrador', cargo: 'ADMIN' },
    { perfil: 'COMERCIAL', email: `comercial@${domain}`, nome: 'Comercial', cargo: 'COMERCIAL' },
    { perfil: 'ADMINISTRATIVO', email: `administrativo@${domain}`, nome: 'Administrativo', cargo: 'ADMINISTRATIVO' },
    { perfil: 'FINANCEIRO', email: `financeiro@${domain}`, nome: 'Financeiro', cargo: 'FINANCEIRO' },
    { perfil: 'LOGISTICA', email: `logistica@${domain}`, nome: 'Logística', cargo: 'LOGISTICA' },
    { perfil: 'ELETRONICA', email: `eletronica@${domain}`, nome: 'Eletrônica', cargo: 'ELETRONICA' },
    { perfil: 'LABORATÓRIO', email: `laboratorio@${domain}`, nome: 'Laboratório', cargo: 'LABORATORIO' },
    { perfil: 'OFICINA', email: `oficina@${domain}`, nome: 'Oficina', cargo: 'OFICINA' },
  ]

  const results = []

  for (const u of users) {
    const perfilId = await getPerfilIdByNome(u.perfil)
    if (!perfilId) {
      throw new Error(`Perfil não encontrado no banco: ${u.perfil}`)
    }

    const password = process.env.DEFAULT_USERS_PASSWORD ? basePassword : defaultPassword()
    const userId = await ensureAuthUser(u.email, password, u.nome)
    await upsertProfile(userId, u.email, u.nome, u.cargo)
    await upsertProfilePerfil(userId, perfilId)

    results.push({
      perfil: u.perfil,
      email: u.email,
      password: process.env.DEFAULT_USERS_PASSWORD ? basePassword : password,
      cargo: u.cargo,
    })
  }

  const safe = results.map(r => ({
    perfil: toAsciiUpper(r.perfil),
    email: r.email,
    password: r.password,
    cargo: r.cargo,
  }))

  console.log(JSON.stringify({ created_or_updated: safe }, null, 2))
}

main().catch((e) => {
  console.error(e?.message || e)
  process.exit(1)
})

