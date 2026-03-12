const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('./supabase');

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '.env'),
];

const envPath = envCandidates.find((p) => fs.existsSync(p));
dotenv.config(envPath ? { path: envPath } : undefined);

process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

// Importa rotas e middleware
const adminRoutes = require('./routes/admin');
const taskflowRoutes = require('./routes/taskflow');
const debugRoutes = require('./routes/debug');
const estoqueRoutes = require('./routes/estoque');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 7005;

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const corsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (isProd && corsOrigins.length === 0) {
  console.error('FATAL: CORS_ORIGINS is not configured in production. Refusing to start.');
  process.exit(1);
}

const corsOptions = {
  origin: corsOrigins.length
    ? function (origin, callback) {
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      }
    : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(':remote-addr :method :url :status :response-time ms - :res[content-length]'));

// Rota Raiz para Verificação Rápida
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'SystemFlow Backend', 
    version: '1.0.0' 
  });
});

// Rota de Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.get('/status', (req, res) => {
  res.status(200).json({
    ok: true,
    status: 'online',
    service: 'SystemFlow Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime_s: Math.round(process.uptime()),
  });
});

app.get('/ready', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) throw error;
    return res.status(200).json({ ok: true, status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unavailable';
    return res.status(503).json({
      ok: false,
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: isProd ? 'dependency_unavailable' : msg,
    });
  }
});

// Rotas Administrativas
app.use('/admin', adminRoutes);
app.use('/taskflow', taskflowRoutes);
app.use('/debug', debugRoutes);
app.use('/estoque', estoqueRoutes);

// Rota Exemplo Protegida
app.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  const msg = err instanceof Error ? err.message : 'Internal Server Error';
  if (String(msg).includes('Not allowed by CORS')) {
    return res.status(403).json({ error: 'CORS blocked' });
  }
  return res.status(500).json({ error: isProd ? 'Internal Server Error' : msg });
});

const server = app.listen(PORT, () => {
  console.log(`\n✅ Backend running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Accessible via http://localhost:${PORT}`);
  console.log(`✅ CORS Policy: ${corsOrigins.length ? `Allowlist (${corsOrigins.length})` : 'Allow All'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Erro: A porta ${PORT} já está em uso.`);
  } else {
    console.error('❌ Falha ao iniciar o servidor:', err);
  }
  process.exit(1);
});

function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Graceful shutdown iniciado...`);
  const shutdownTimeout = setTimeout(() => {
    console.error('Timeout de graceful shutdown. Forçando saída.');
    process.exit(1);
  }, 10000);
  shutdownTimeout.unref();
  server.close(() => {
    console.log('Servidor HTTP fechado.');
    clearTimeout(shutdownTimeout);
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
