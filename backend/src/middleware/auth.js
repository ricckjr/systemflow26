const { supabaseAdmin } = require('../supabase');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify token using Supabase Auth (getUser checks validity and signature)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check user profile status
    // Removed 'is_admin' because it does not exist in the database schema.
    // Using 'cargo' to determine admin status.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, cargo, ativo') 
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Auth Middleware: Profile not found for user', user.id);
      // More descriptive error for debugging
      return res.status(403).json({ error: 'Profile not found. Please contact support.' });
    }

    if (!profile.ativo) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    req.user = user;
    req.profile = profile;
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const requireAdmin = (req, res, next) => {
  // Check 'cargo' instead of non-existent 'is_admin' column
  if (!req.profile || req.profile.cargo !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
