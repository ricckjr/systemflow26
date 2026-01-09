#!/bin/bash

# ==========================================
# SystemFlow Backend - Admin User Management
# Test Script & Documentation
# ==========================================

# Base URL
API_URL="http://localhost:7005/admin/users"

# ⚠️ TOKEN REQUIRED ⚠️
# Replace this with a valid JWT token from an admin user.
# You can get this by logging in via the frontend or Supabase dashboard.
ADMIN_TOKEN="YOUR_ADMIN_JWT_HERE"

# Headers
AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"
CONTENT_TYPE="Content-Type: application/json"

echo "========================================"
echo "1. List Users (GET /admin/users)"
echo "========================================"
curl -X GET "$API_URL?page=1&limit=5" \
  -H "$AUTH_HEADER"

echo -e "\n\n========================================"
echo "2. Create User (POST /admin/users)"
echo "========================================"
# Creates user in Auth and Profile
curl -X POST "$API_URL" \
  -H "$AUTH_HEADER" \
  -H "$CONTENT_TYPE" \
  -d '{
    "nome": "João Silva",
    "email_login": "joao.silva@empresa.com",
    "email_corporativo": "joao@systemflow.com",
    "senha": "SenhaSegura@123",
    "cargo": "Vendedor",
    "ativo": true,
    "telefone": "11999999999",
    "ramal": "1234"
  }'

# Save the ID from the output above for the next steps
# USER_ID="<ID_FROM_OUTPUT>"

echo -e "\n\n========================================"
echo "3. Update User (PATCH /admin/users/:id)"
echo "========================================"
# Replace :id with real ID
curl -X PATCH "$API_URL/USER_ID_HERE" \
  -H "$AUTH_HEADER" \
  -H "$CONTENT_TYPE" \
  -d '{
    "cargo": "Gerente de Vendas",
    "ramal": "9999"
  }'

echo -e "\n\n========================================"
echo "4. Disable User (PATCH /admin/users/:id/disable)"
echo "========================================"
curl -X PATCH "$API_URL/USER_ID_HERE/disable" \
  -H "$AUTH_HEADER"

echo -e "\n\n========================================"
echo "5. Enable User (PATCH /admin/users/:id/enable)"
echo "========================================"
curl -X PATCH "$API_URL/USER_ID_HERE/enable" \
  -H "$AUTH_HEADER"

echo -e "\n\n========================================"
echo "6. Reset Password (POST /admin/users/:id/reset-password)"
echo "========================================"
curl -X POST "$API_URL/USER_ID_HERE/reset-password" \
  -H "$AUTH_HEADER" \
  -H "$CONTENT_TYPE" \
  -d '{
    "senha": "NovaSenha@2024"
  }'

echo -e "\n\n========================================"
echo "7. Delete User (DELETE /admin/users/:id)"
echo "========================================"
curl -X DELETE "$API_URL/USER_ID_HERE" \
  -H "$AUTH_HEADER"

echo -e "\n\nDone."
