const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
];

const envPath = envCandidates.find((p) => fs.existsSync(p));
dotenv.config(envPath ? { path: envPath } : undefined);

process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

// Importa rotas e middleware
const adminRoutes = require('./routes/admin');
const taskflowRoutes = require('./routes/taskflow');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 7005;

// === Configuração CORS Melhorada ===
// Permite requisições do frontend local
const corsOptions = {
  origin: true, // Reflete a origem da requisição (útil para desenvolvimento)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('combined')); // Log de requisições

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

// Rotas Administrativas
app.use('/admin', adminRoutes);
app.use('/taskflow', taskflowRoutes);

// Rota Exemplo Protegida
app.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Accessible via http://localhost:${PORT}`);
  console.log(`✅ CORS Policy: Allow All (Development Mode)`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Erro: A porta ${PORT} já está em uso.`);
  } else {
    console.error('❌ Falha ao iniciar o servidor:', err);
  }
  process.exit(1);
});
