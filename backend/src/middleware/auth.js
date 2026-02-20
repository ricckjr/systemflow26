const { supabaseAdmin } = require('../supabase');

const authCacheTtlMs = Math.max(0, Number(process.env.AUTH_CACHE_TTL_MS || 30000));
const authCache = new Map();

function extractBearerToken(authHeader) {
  const raw = String(authHeader || '').trim();
  if (!raw) return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function cacheGet(token) {
  if (!authCacheTtlMs) return null;
  const hit = authCache.get(token);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    authCache.delete(token);
    return null;
  }
  return hit;
}

function cacheSet(token, value) {
  if (!authCacheTtlMs) return;
  if (authCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of authCache.entries()) {
      if (v.expiresAt <= now) authCache.delete(k);
    }
  }
  authCache.set(token, { ...value, expiresAt: Date.now() + authCacheTtlMs });
}

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = extractBearerToken(authHeader);
  if (!token) return res.status(401).json({ error: 'Invalid Authorization header' });

  const cached = cacheGet(token);
  if (cached) {
    req.user = cached.user;
    req.profile = cached.profile;
    return next();
  }

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
    cacheSet(token, { user, profile });
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const requirePermission = (modulo, acao) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const cargo = String(req.profile?.cargo || '').toUpperCase().trim();
      if (cargo === 'ADMIN' || cargo === 'ADMINISTRADOR') {
        return next();
      }

      const { data, error } = await supabaseAdmin.rpc('has_permission', {
        user_id: req.user.id,
        modulo,
        acao
      });

      if (error) {
        console.error('Permission check error:', error);
        return res.status(500).json({ error: 'Permission check failed' });
      }

      if (!data) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      next();
    } catch (err) {
      console.error('Permission middleware error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};

const requireAdmin = (req, res, next) => {
  // Check 'cargo' instead of non-existent 'is_admin' column
  const cargo = String(req.profile?.cargo || '').toUpperCase().trim();
  if (cargo !== 'ADMIN' && cargo !== 'ADMINISTRADOR') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requirePermission };
