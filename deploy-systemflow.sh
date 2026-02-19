#!/bin/bash

# Deploy SystemFlow
# Backend (container): systemflow-backend:7005
# Frontend (container): systemflow-frontend:80

echo "🚀 Starting SystemFlow Deployment..."

if [ ! -f backend/.env ]; then
  echo "❌ backend/.env file not found! Please create one with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and VITE_* if using docker compose build args)."
  exit 1
fi

echo "📦 Building and Starting Containers..."
docker compose --env-file backend/.env up -d --build

echo "✅ SystemFlow Deployed!"
echo "   - Backend upstream: systemflow-backend:7005"
echo "   - Frontend upstream: systemflow-frontend:80"
echo "⚠️  Ensure your reverse-proxy (ex.: NGINX Proxy Manager) is connected to the Docker network 'proxy'."
