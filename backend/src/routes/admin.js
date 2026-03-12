const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requirePermission('CONFIGURACOES', 'CONTROL'));

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

function sendError(res, err, statusCode = 500) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[admin] Error:', msg, err?.stack || '');
  return res.status(statusCode).json({
    error: isProd ? 'Internal Server Error' : msg
  });
}

function isMissingTable(err, tableName) {
  const msg = String(err?.message || '');
  const details = String(err?.details || '');
  const hint = String(err?.hint || '');
  const code = String(err?.code || '');
  const raw = `${msg} ${details} ${hint} ${code}`.trim();
  const lower = raw.toLowerCase();

  const t = String(tableName || '').toLowerCase();
  const hasTableName =
    lower.includes(`public.${t}`) ||
    lower.includes(`'${t}'`) ||
    lower.includes(`"${t}"`) ||
    lower.includes(` ${t} `) ||
    lower.endsWith(` ${t}`) ||
    lower.includes(` ${t}.`) ||
    lower.includes(`.${t} `);

  const isSchemaCache =
    lower.includes('schema cache') ||
    lower.includes('could not find the table') ||
    lower.includes('could not find the') ||
    lower.includes('relation') ||
    code.startsWith('PGRST');

  return hasTableName && isSchemaCache;
}

async function attachRolesToUsers(users) {
  const userIds = (users || []).map((u) => u.id).filter(Boolean);
  if (userIds.length === 0) return users;

  let data = null;
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role_id, roles(nome, descricao, ativo)')
      .in('user_id', userIds);

    if (error) throw error;
    data = rows ?? [];
  } catch (err) {
    if (!isMissingTable(err, 'user_roles')) throw err;

    const { data: legacyRows, error: legacyError } = await supabaseAdmin
      .from('profile_perfis')
      .select('user_id, perfil_id, perfis(perfil_nome, perfil_descricao)')
      .in('user_id', userIds);

    if (legacyError) throw legacyError;

    const map = new Map();
    (legacyRows || []).forEach((row) => {
      map.set(row.user_id, [
        {
          role_id: row.perfil_id,
          nome: row.perfis?.perfil_nome ?? null,
          descricao: row.perfis?.perfil_descricao ?? null,
          ativo: null
        }
      ]);
    });

    return (users || []).map((u) => ({
      ...u,
      rbac_roles: map.get(u.id) ?? []
    }));
  }

  const map = new Map();
  (data || []).forEach((row) => {
    const list = map.get(row.user_id) || [];
    list.push({
      role_id: row.role_id,
      nome: row.roles?.nome ?? null,
      descricao: row.roles?.descricao ?? null,
      ativo: row.roles?.ativo ?? null
    });
    map.set(row.user_id, list);
  });

  return (users || []).map((u) => ({
    ...u,
    rbac_roles: map.get(u.id) ?? []
  }));
}

function parsePagination(query) {
  const pageRaw = query?.page;
  const limitRaw = query?.limit;
  const page = Math.max(1, Number.parseInt(String(pageRaw || '1'), 10) || 1);
  const limit = Math.min(1000, Math.max(1, Number.parseInt(String(limitRaw || '50'), 10) || 50));
  const offset = (page - 1) * limit;
  const end = offset + limit - 1;
  return { page, limit, offset, end };
}

const PROFILE_SELECT = 'id, nome, email_login, email_corporativo, telefone, ramal, cargo, avatar_url, ativo, created_at, updated_at';

function normalizeCargo(input) {
  const raw = String(input ?? '').trim();
  const normalized = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  if (normalized === 'ADMIN' || normalized === 'ADMINISTRADOR' || normalized === 'ADMINISTRADORA') return 'ADMIN';
  if (normalized === 'FINANCEIRO') return 'FINANCEIRO';
  if (normalized === 'MARKETING') return 'MARKETING';
  if (normalized === 'ADMINISTRATIVO') return 'ADMINISTRATIVO';
  if (normalized === 'RECURSOS_HUMANOS' || normalized === 'RECURSOS_HUMANO' || normalized === 'RH') return 'RECURSOS_HUMANOS';
  if (normalized === 'DEPARTAMENTO_PESSOAL' || normalized === 'DP') return 'DEPARTAMENTO_PESSOAL';
  if (normalized === 'LOGISTICA') return 'LOGISTICA';
  if (normalized === 'OFICINA' || normalized === 'PRODUCAO') return 'OFICINA';
  if (normalized === 'TECNICO' || normalized === 'ELETRONICA' || normalized === 'LABORATORIO') return 'TECNICO';
  if (normalized === 'VENDEDOR' || normalized === 'COMERCIAL') return 'VENDEDOR';

  return 'VENDEDOR';
}

function parseAvatarDataUrl(dataUrl) {
  const raw = String(dataUrl || '')
  const m = raw.match(/^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return null
  const contentType = m[1]
  const b64 = m[2]
  const buffer = Buffer.from(b64, 'base64')
  const ext = contentType === 'image/png' ? 'png' : 'jpg'
  return { buffer, contentType, ext }
}

// === 1. LIST USERS ===
router.get('/users', async (req, res) => {
  const { page, limit, offset, end } = parsePagination(req.query);
  const search = String(req.query?.search || '').trim();

  try {
    let query = supabaseAdmin
      .from('profiles')
      .select(PROFILE_SELECT, { count: 'exact' })
      .range(offset, end)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('nome', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    const users = await attachRolesToUsers(data);

    res.json({
      users,
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error('List Users Error:', err);
    return sendError(res, err);
  }
});

// === 2. GET SINGLE USER ===
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;
    const users = await attachRolesToUsers([data]);
    res.json(users[0] ?? data);
  } catch (err) {
    return sendError(res, err);
  }
});

// === 3. CREATE USER ===
router.post('/users', async (req, res) => {
  // Extract fields strictly as per requirement
  const { 
    nome, 
    email_login, 
    email_corporativo, 
    senha, 
    cargo, 
    ativo,
    telefone,
    ramal,
    role_ids
  } = req.body;

  // Validation
  if (!email_login || !senha || !nome) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email_login, senha' });
  }

  try {
    const normalizedCargo = normalizeCargo(cargo);
    // A. Create in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email_login,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, cargo: normalizedCargo }
    });

    if (authError) throw authError;

    // B. Insert into public.profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        nome,
        email_login,
        email_corporativo: email_corporativo || email_login, // Fallback if needed
        telefone,
        ramal,
        cargo: normalizedCargo,
        ativo: ativo !== undefined ? ativo : true,
        // is_admin defaults to false usually, or handled by a separate logic. 
        // Requirement didn't explicitly ask for is_admin in the POST body for creation, 
        // but often it's needed. Assuming default user for now unless specified.
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      // Rollback Auth user if profile fails? 
      // For now, just log and return error, but user exists in Auth.
      console.error('Profile Creation Error:', profileError);
      // Clean up auth user to maintain consistency
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    if (Array.isArray(role_ids) && role_ids.length > 0) {
      try {
        const { error: delError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', authData.user.id);
        if (delError) throw delError;

        const rows = role_ids.map((role_id) => ({ user_id: authData.user.id, role_id }));
        const { error: insError } = await supabaseAdmin
          .from('user_roles')
          .insert(rows);
        if (insError) throw insError;
      } catch (err) {
        if (!isMissingTable(err, 'user_roles')) throw err;

        const { error: legacyAssignError } = await supabaseAdmin
          .from('profile_perfis')
          .upsert({ user_id: authData.user.id, perfil_id: role_ids[0] });
        if (legacyAssignError) throw legacyAssignError;
      }
    }

    res.status(201).json({ 
      message: 'Usuário criado com sucesso',
      user: { id: authData.user.id, nome, email_login } 
    });

  } catch (err) {
    console.error('Create User Error:', err);
    return sendError(res, err);
  }
});

// === 4. UPDATE USER ===
router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    nome, 
    email_login, 
    email_corporativo, 
    cargo, 
    telefone, 
    ramal, 
    ativo,
    senha // Optional password update
  } = req.body;

  try {
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (nome !== undefined) updates.nome = nome;
    if (email_login !== undefined) updates.email_login = email_login;
    if (email_corporativo !== undefined) updates.email_corporativo = email_corporativo;
    if (cargo !== undefined) updates.cargo = normalizeCargo(cargo);
    if (telefone !== undefined) updates.telefone = telefone;
    if (ramal !== undefined) updates.ramal = ramal;
    if (ativo !== undefined) updates.ativo = ativo;

    if (Object.keys(updates).length <= 1) { // only updated_at
      return res.status(400).json({ error: 'Nenhum dado para atualizar' });
    }

    // A. Update Profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (profileError) throw profileError;

    // B. Update Auth (if sensitive fields changed)
    const authUpdates = {};
    if (email_login !== undefined) authUpdates.email = email_login;
    if (senha !== undefined) authUpdates.password = senha;
    if (nome !== undefined || cargo !== undefined) {
      authUpdates.user_metadata = {};
      if (nome !== undefined) authUpdates.user_metadata.nome = nome;
      if (cargo !== undefined) authUpdates.user_metadata.cargo = normalizeCargo(cargo);
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authError) throw authError;
    }

    res.json({ message: 'Usuário atualizado com sucesso' });

  } catch (err) {
    console.error('Update User Error:', err);
    return sendError(res, err);
  }
});

router.post('/users/:id/avatar', async (req, res) => {
  const { id } = req.params
  const { dataUrl } = req.body || {}
  const parsed = parseAvatarDataUrl(dataUrl)
  if (!parsed) return res.status(400).json({ error: 'Avatar inválido. Envie PNG/JPEG em dataUrl base64.' })
  if (parsed.buffer.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Avatar muito grande. Máximo 3MB.' })

  try {
    const path = `avatars/${id}-${Date.now()}.${parsed.ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(path, parsed.buffer, { contentType: parsed.contentType, upsert: true })
    if (uploadError) throw uploadError

    const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)
    const avatar_url = pub?.publicUrl || null

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (profileError) throw profileError

    res.json({ avatar_url })
  } catch (err) {
    return sendError(res, err)
  }
})

// === 5. DISABLE USER ===
router.patch('/users/:id/disable', async (req, res) => {
  const { id } = req.params;

  try {
    // A. Set profiles.ativo = false
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (profileError) throw profileError;

    // B. Invalidate Sessions (Sign Out)
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(id);
    if (signOutError) console.warn('SignOut Warning:', signOutError);

    res.json({ message: 'Usuário desativado e sessões invalidadas' });
  } catch (err) {
    return sendError(res, err);
  }
});

// === 6. ENABLE USER ===
router.patch('/users/:id/enable', async (req, res) => {
  const { id } = req.params;

  try {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ ativo: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (profileError) throw profileError;

    res.json({ message: 'Usuário reativado' });
  } catch (err) {
    return sendError(res, err);
  }
});

// === 7. DELETE USER ===
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    // Profile is typically deleted via Cascade, but if not:
    // await supabaseAdmin.from('profiles').delete().eq('id', id);

    res.json({ message: 'Usuário excluído permanentemente' });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/rbac/perfis', async (req, res) => {
  try {
    try {
      const { data, error } = await supabaseAdmin
        .from('roles')
        .select('id, nome, descricao, ativo, created_at, updated_at')
        .order('nome', { ascending: true });

      if (error) throw error;
      const perfis = (data ?? []).map((r) => ({
        perfil_id: r.id,
        perfil_nome: r.nome,
        perfil_descricao: r.descricao,
        ativo: r.ativo,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
      return res.json({ perfis });
    } catch (err) {
      if (!isMissingTable(err, 'roles')) throw err;
      const { data, error } = await supabaseAdmin
        .from('perfis')
        .select('perfil_id, perfil_nome, perfil_descricao, created_at, updated_at')
        .order('perfil_nome', { ascending: true });
      if (error) throw error;
      const perfis = (data ?? []).map((r) => ({
        perfil_id: r.perfil_id,
        perfil_nome: r.perfil_nome,
        perfil_descricao: r.perfil_descricao,
        ativo: true,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
      return res.json({ perfis });
    }
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/rbac/perfis', async (req, res) => {
  const { perfil_nome, perfil_descricao } = req.body || {};
  if (!perfil_nome) return res.status(400).json({ error: 'perfil_nome é obrigatório' });

  try {
    const { data, error } = await supabaseAdmin
      .from('roles')
      .insert({ nome: perfil_nome, descricao: perfil_descricao ?? null, ativo: true })
      .select('id, nome, descricao, ativo, created_at, updated_at')
      .single();

    if (error) throw error;
    res.status(201).json({
      perfil_id: data.id,
      perfil_nome: data.nome,
      perfil_descricao: data.descricao,
      ativo: data.ativo,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/rbac/perfis/:perfilId', async (req, res) => {
  const { perfilId } = req.params;
  const { perfil_nome, perfil_descricao, ativo } = req.body || {};

  try {
    const payload = {};
    if (perfil_nome !== undefined) payload.nome = perfil_nome;
    if (perfil_descricao !== undefined) payload.descricao = perfil_descricao;
    if (ativo !== undefined) payload.ativo = Boolean(ativo);

    const { data, error } = await supabaseAdmin
      .from('roles')
      .update(payload)
      .eq('id', perfilId)
      .select('id, nome, descricao, ativo, created_at, updated_at')
      .single();

    if (error) throw error;
    res.json({
      perfil_id: data.id,
      perfil_nome: data.nome,
      perfil_descricao: data.descricao,
      ativo: data.ativo,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/rbac/perfis/:perfilId', async (req, res) => {
  const { perfilId } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from('roles')
      .delete()
      .eq('id', perfilId);

    if (error) throw error;
    res.json({ message: 'Perfil removido' });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/rbac/permissoes', async (req, res) => {
  try {
    try {
      const { data, error } = await supabaseAdmin
        .from('permissions')
        .select('id, codigo, modulo, acao, descricao, created_at, updated_at')
        .order('modulo', { ascending: true })
        .order('acao', { ascending: true });

      if (error) throw error;
      const permissoes = (data ?? []).map((p) => ({
        permissao_id: p.id,
        codigo: p.codigo,
        modulo: p.modulo,
        acao: p.acao,
        descricao: p.descricao,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
      return res.json({ permissoes });
    } catch (err) {
      if (!isMissingTable(err, 'permissions')) throw err;

      const { data, error } = await supabaseAdmin
        .from('permissoes')
        .select('permissao_id, modulo, acao, descricao, created_at, updated_at')
        .order('modulo', { ascending: true })
        .order('acao', { ascending: true });

      if (error) throw error;
      const permissoes = (data ?? []).map((p) => ({
        permissao_id: p.permissao_id,
        codigo: null,
        modulo: p.modulo,
        acao: p.acao,
        descricao: p.descricao,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
      return res.json({ permissoes });
    }
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/rbac/permissoes', async (req, res) => {
  const { codigo, modulo, acao, descricao } = req.body || {};
  if (!codigo || !modulo || !acao) return res.status(400).json({ error: 'codigo, modulo e acao são obrigatórios' });

  try {
    const { data, error } = await supabaseAdmin
      .from('permissions')
      .insert({ codigo, modulo, acao, descricao: descricao ?? null })
      .select('id, codigo, modulo, acao, descricao, created_at, updated_at')
      .single();

    if (error) throw error;
    res.status(201).json({
      permissao_id: data.id,
      codigo: data.codigo,
      modulo: data.modulo,
      acao: data.acao,
      descricao: data.descricao,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/rbac/permissoes/:permissaoId', async (req, res) => {
  const { permissaoId } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from('permissions')
      .delete()
      .eq('id', permissaoId);

    if (error) throw error;
    res.json({ message: 'Permissão removida' });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/rbac/perfis/:perfilId/permissoes', async (req, res) => {
  const { perfilId } = req.params;
  try {
    try {
      const { data, error } = await supabaseAdmin
        .from('role_permissions')
        .select('permission_id, permissions(codigo, modulo, acao, descricao)')
        .eq('role_id', perfilId);

      if (error) throw error;
      const itens = (data ?? []).map((row) => ({
        permissao_id: row.permission_id,
        permissao: row.permissions ?? null
      }));
      return res.json({ itens });
    } catch (err) {
      if (!isMissingTable(err, 'role_permissions')) throw err;

      const { data, error } = await supabaseAdmin
        .from('perfil_permissoes')
        .select('permissao_id, permissoes(modulo, acao, descricao)')
        .eq('perfil_id', perfilId);

      if (error) throw error;
      const itens = (data ?? []).map((row) => ({
        permissao_id: row.permissao_id,
        permissao: row.permissoes ?? null
      }));
      return res.json({ itens });
    }
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/rbac/perfis/:perfilId/permissoes', async (req, res) => {
  const { perfilId } = req.params;
  const { permissao_ids } = req.body || {};
  if (!Array.isArray(permissao_ids)) return res.status(400).json({ error: 'permissao_ids deve ser um array' });

  try {
    try {
      const { error: delError } = await supabaseAdmin
        .from('role_permissions')
        .delete()
        .eq('role_id', perfilId);

      if (delError) throw delError;

      const inserts = permissao_ids.map((permission_id) => ({ role_id: perfilId, permission_id }));
      if (inserts.length > 0) {
        const { error: insError } = await supabaseAdmin
          .from('role_permissions')
          .insert(inserts);

        if (insError) throw insError;
      }
      return res.json({ message: 'Permissões atualizadas' });
    } catch (err) {
      if (!isMissingTable(err, 'role_permissions')) throw err;

      const { error: delError } = await supabaseAdmin
        .from('perfil_permissoes')
        .delete()
        .eq('perfil_id', perfilId);
      if (delError) throw delError;

      const inserts = permissao_ids.map((permissao_id) => ({ perfil_id: perfilId, permissao_id }));
      if (inserts.length > 0) {
        const { error: insError } = await supabaseAdmin
          .from('perfil_permissoes')
          .insert(inserts);
        if (insError) throw insError;
      }

      return res.json({ message: 'Permissões atualizadas' });
    }
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/users/:id/roles', async (req, res) => {
  const { id } = req.params;
  const { role_ids } = req.body || {};
  if (!Array.isArray(role_ids)) return res.status(400).json({ error: 'role_ids deve ser um array' });

  try {
    try {
      const { error: delError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', id);
      if (delError) throw delError;

      if (role_ids.length > 0) {
        const rows = role_ids.map((role_id) => ({ user_id: id, role_id }));
        const { error: insError } = await supabaseAdmin
          .from('user_roles')
          .insert(rows);
        if (insError) throw insError;
      }

      return res.json({ message: 'Roles atualizadas' });
    } catch (err) {
      if (!isMissingTable(err, 'user_roles')) throw err;

      const { error: delError } = await supabaseAdmin
        .from('profile_perfis')
        .delete()
        .eq('user_id', id);
      if (delError) throw delError;

      if (role_ids.length > 0) {
        const { error: insError } = await supabaseAdmin
          .from('profile_perfis')
          .insert({ user_id: id, perfil_id: role_ids[0] });
        if (insError) throw insError;
      }

      return res.json({ message: 'Roles atualizadas' });
    }
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/users/:id/perfil', async (req, res) => {
  const { id } = req.params;
  const { perfil_id } = req.body || {};
  if (!perfil_id) return res.status(400).json({ error: 'perfil_id é obrigatório' });

  try {
    try {
      const { error: delError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', id);
      if (delError) throw delError;

      const { error: insError } = await supabaseAdmin
        .from('user_roles')
        .insert([{ user_id: id, role_id: perfil_id }]);
      if (insError) throw insError;

      return res.json({ message: 'Perfil atribuído' });
    } catch (err) {
      if (!isMissingTable(err, 'user_roles')) throw err;

      const { error: legacyAssignError } = await supabaseAdmin
        .from('profile_perfis')
        .upsert({ user_id: id, perfil_id });
      if (legacyAssignError) throw legacyAssignError;

      return res.json({ message: 'Perfil atribuído' });
    }
  } catch (err) {
    return sendError(res, err);
  }
});

// === 8. RESET PASSWORD ===
router.post('/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { novaSenha } = req.body || {}; // Using Portuguese param as per context, or match requirement

  // Requirement says: POST /admin/users/:id/reset-password
  // Does not specify body field name, assuming "senha" or "password" or "novaSenha".
  // Let's support "senha" based on CREATE payload.
  const passwordToSetRaw = novaSenha || req.body?.senha || req.body?.password || req.body?.newPassword;
  const passwordToSet = typeof passwordToSetRaw === 'string' ? passwordToSetRaw.trim() : '';

  if (!passwordToSet) {
    return res.status(400).json({ error: 'Nova senha é obrigatória' });
  }
  if (passwordToSet.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: passwordToSet
    });

    if (error) throw error;

    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
