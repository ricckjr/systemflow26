#!/bin/bash

# Deploy SystemFlow
# Backend: 7005
# Frontend: 7001

echo "🚀 Starting SystemFlow Deployment..."

if [ ! -f backend/.env ]; then
  echo "❌ backend/.env file not found! Please create one with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and VITE_* if using docker compose build args)."
  exit 1
fi

echo "📦 Building and Starting Containers..."
docker compose --env-file backend/.env up -d --build

echo "✅ SystemFlow Deployed!"
echo "   - Backend: http://localhost:7005 (Mapped to api.systemflow.apliflow.com via NGINX)"
echo "   - Frontend: http://localhost:7001 (Mapped to systemflow.apliflow.com via NGINX)"
echo "⚠️  Ensure NGINX Proxy Manager is configured to point to these ports."
