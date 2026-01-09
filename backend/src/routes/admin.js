const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

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

    res.json({
      users: data,
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
    res.json(data);
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
