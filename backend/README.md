# SystemFlow Backend

Backend administrativo seguro para o SystemFlow, construído com Node.js e Express, integrando com Supabase Self-Hosted.

## 🚀 Como Rodar

### Pré-requisitos
- Node.js 18+
- Docker (opcional)
- Chave `service_role` do Supabase

### Instalação

1. Instale as dependências:
   ```bash
   cd backend
   npm install
   ```

2. Configure as variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
   Edite o arquivo `.env` e adicione sua `SUPABASE_SERVICE_ROLE_KEY`.

3. Inicie o servidor:
   ```bash
   npm run dev
   ```

### Docker

1. Construa a imagem:
   ```bash
   docker build -t systemflow-backend .
   ```

2. Rode o container:
   ```bash
   docker run -p 7005:7005 --env-file .env systemflow-backend
   ```

## 🔐 Autenticação

O backend espera um token JWT do Supabase no header `Authorization`:
```
Authorization: Bearer <seu_token_jwt>
```
O usuário deve ter `is_admin = true` e `ativo = true` na tabela `public.profiles`.

## 🧩 Rotas

Todas as rotas são prefixadas com `/admin`.

| Método | Rota | Descrição | Body Exemplo |
|--------|------|-----------|--------------|
| POST | `/admin/users` | Criar usuário | `{ "email": "...", "password": "...", "nome": "...", "cargo": "...", "is_admin": true }` |
| PATCH | `/admin/users/:id` | Atualizar usuário | `{ "nome": "Novo Nome", "cargo": "GERENTE" }` |
| PATCH | `/admin/users/:id/disable` | Desativar usuário | - |
| PATCH | `/admin/users/:id/enable` | Reativar usuário | - |
| DELETE | `/admin/users/:id` | Excluir usuário | - |
| POST | `/admin/users/:id/reset-password` | Resetar senha | `{ "newPassword": "nova_senha_forte" }` |

## 🧪 Testes com cURL

**Criar Usuário:**
```bash
curl -X POST http://localhost:7005/admin/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@exemplo.com", "password":"123", "nome":"Teste", "cargo":"VENDEDOR"}'
```

**Desativar Usuário:**
```bash
curl -X PATCH http://localhost:7005/admin/users/<USER_ID>/disable \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
