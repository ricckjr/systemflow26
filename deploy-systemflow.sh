#!/bin/bash

# Deploy SystemFlow
# Backend: 7005
# Frontend: 7001

echo "🚀 Starting SystemFlow Deployment..."

if [ ! -f .env ]; then
  echo "❌ .env file not found! Please create one with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY."
  exit 1
fi

# Export env vars to be sure
export $(grep -v '^#' .env | xargs)

echo "📦 Building and Starting Containers..."
docker-compose up -d --build

echo "✅ SystemFlow Deployed!"
echo "   - Backend: http://localhost:7005 (Mapped to api.systemflow.apliflow.com via NGINX)"
echo "   - Frontend: http://localhost:7001 (Mapped to systemflow.apliflow.com via NGINX)"
echo "⚠️  Ensure NGINX Proxy Manager is configured to point to these ports."
