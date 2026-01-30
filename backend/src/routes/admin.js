const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requirePermission('CONFIGURACOES', 'CONTROL'));

async function attachPerfisToUsers(users) {
  const userIds = (users || []).map((u) => u.id).filter(Boolean);
  if (userIds.length === 0) return users;

  const { data, error } = await supabaseAdmin
    .from('profile_perfis')
    .select('user_id, perfil_id, perfis(perfil_nome, perfil_descricao)')
    .in('user_id', userIds);

  if (error) throw error;

  const map = new Map();
  (data || []).forEach((row) => {
    map.set(row.user_id, {
      perfil_id: row.perfil_id,
      perfil_nome: row.perfis?.perfil_nome ?? null,
      perfil_descricao: row.perfis?.perfil_descricao ?? null
    });
  });

  return (users || []).map((u) => ({
    ...u,
    rbac_perfil: map.get(u.id) ?? null
  }));
}

// === 1. LIST USERS ===
router.get('/users', async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('nome', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    const users = await attachPerfisToUsers(data);

    res.json({
      users,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error('List Users Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === 2. GET SINGLE USER ===
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    const users = await attachPerfisToUsers([data]);
    res.json(users[0] ?? data);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    ramal
  } = req.body;

  // Validation
  if (!email_login || !senha || !nome) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email_login, senha' });
  }

  try {
    // A. Create in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email_login,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, cargo }
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
        cargo,
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

    const perfilNome =
      cargo === 'ADMIN'
        ? 'ADMIN'
        : cargo === 'FINANCEIRO'
        ? 'FINANCEIRO'
        : cargo === 'OFICINA' || cargo === 'TECNICO'
        ? 'PRODUCAO'
        : 'VENDEDOR';

    const { data: perfilRow, error: perfilError } = await supabaseAdmin
      .from('perfis')
      .select('perfil_id')
      .eq('perfil_nome', perfilNome)
      .maybeSingle();

    if (perfilError) throw perfilError;

    if (perfilRow?.perfil_id) {
      const { error: assignError } = await supabaseAdmin
        .from('profile_perfis')
        .upsert({ user_id: authData.user.id, perfil_id: perfilRow.perfil_id });

      if (assignError) throw assignError;
    }

    res.status(201).json({ 
      message: 'Usuário criado com sucesso',
      user: { id: authData.user.id, nome, email_login } 
    });

  } catch (err) {
    console.error('Create User Error:', err);
    res.status(500).json({ error: err.message });
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
    if (cargo !== undefined) updates.cargo = cargo;
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
    if (email_login) authUpdates.email = email_login;
    if (senha) authUpdates.password = senha;
    if (nome || cargo) {
      authUpdates.user_metadata = {};
      if (nome) authUpdates.user_metadata.nome = nome;
      if (cargo) authUpdates.user_metadata.cargo = cargo;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authError) throw authError;
    }

    res.json({ message: 'Usuário atualizado com sucesso' });

  } catch (err) {
    console.error('Update User Error:', err);
    res.status(500).json({ error: err.message });
  }
});

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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

router.get('/rbac/perfis', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('perfis')
      .select('*')
      .order('perfil_nome', { ascending: true });

    if (error) throw error;
    res.json({ perfis: data ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rbac/perfis', async (req, res) => {
  const { perfil_nome, perfil_descricao } = req.body || {};
  if (!perfil_nome) return res.status(400).json({ error: 'perfil_nome é obrigatório' });

  try {
    const { data, error } = await supabaseAdmin
      .from('perfis')
      .insert({ perfil_nome, perfil_descricao: perfil_descricao ?? null })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/rbac/perfis/:perfilId', async (req, res) => {
  const { perfilId } = req.params;
  const { perfil_nome, perfil_descricao } = req.body || {};

  try {
    const payload = {};
    if (perfil_nome !== undefined) payload.perfil_nome = perfil_nome;
    if (perfil_descricao !== undefined) payload.perfil_descricao = perfil_descricao;

    const { data, error } = await supabaseAdmin
      .from('perfis')
      .update(payload)
      .eq('perfil_id', perfilId)
      .select('*')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/rbac/perfis/:perfilId', async (req, res) => {
  const { perfilId } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from('perfis')
      .delete()
      .eq('perfil_id', perfilId);

    if (error) throw error;
    res.json({ message: 'Perfil removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rbac/permissoes', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('permissoes')
      .select('*')
      .order('modulo', { ascending: true })
      .order('acao', { ascending: true });

    if (error) throw error;
    res.json({ permissoes: data ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rbac/permissoes', async (req, res) => {
  const { modulo, acao, descricao } = req.body || {};
  if (!modulo || !acao) return res.status(400).json({ error: 'modulo e acao são obrigatórios' });

  try {
    const { data, error } = await supabaseAdmin
      .from('permissoes')
      .insert({ modulo, acao, descricao: descricao ?? null })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/rbac/permissoes/:permissaoId', async (req, res) => {
  const { permissaoId } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from('permissoes')
      .delete()
      .eq('permissao_id', permissaoId);

    if (error) throw error;
    res.json({ message: 'Permissão removida' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rbac/perfis/:perfilId/permissoes', async (req, res) => {
  const { perfilId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('perfil_permissoes')
      .select('permissao_id, permissoes(modulo, acao, descricao)')
      .eq('perfil_id', perfilId);

    if (error) throw error;
    res.json({ itens: data ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/rbac/perfis/:perfilId/permissoes', async (req, res) => {
  const { perfilId } = req.params;
  const { permissao_ids } = req.body || {};
  if (!Array.isArray(permissao_ids)) return res.status(400).json({ error: 'permissao_ids deve ser um array' });

  try {
    const { error: delError } = await supabaseAdmin
      .from('perfil_permissoes')
      .delete()
      .eq('perfil_id', perfilId);

    if (delError) throw delError;

    const inserts = permissao_ids.map((permissao_id) => ({ perfil_id: perfilId, permissao_id }));
    const { error: insError } = await supabaseAdmin
      .from('perfil_permissoes')
      .insert(inserts);

    if (insError) throw insError;
    res.json({ message: 'Permissões atualizadas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id/perfil', async (req, res) => {
  const { id } = req.params;
  const { perfil_id } = req.body || {};
  if (!perfil_id) return res.status(400).json({ error: 'perfil_id é obrigatório' });

  try {
    const { error } = await supabaseAdmin
      .from('profile_perfis')
      .upsert({ user_id: id, perfil_id });

    if (error) throw error;
    res.json({ message: 'Perfil atribuído' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === 8. RESET PASSWORD ===
router.post('/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { novaSenha } = req.body; // Using Portuguese param as per context, or match requirement

  // Requirement says: POST /admin/users/:id/reset-password
  // Does not specify body field name, assuming "senha" or "password" or "novaSenha".
  // Let's support "senha" based on CREATE payload.
  const passwordToSet = novaSenha || req.body.senha || req.body.password;

  if (!passwordToSet) {
    return res.status(400).json({ error: 'Nova senha é obrigatória' });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: passwordToSet
    });

    if (error) throw error;

    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
