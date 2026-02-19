# Relatório de Arquitetura e Deploy — SystemFlow

## 1. Visão Geral

O SystemFlow é dividido em:
- **Frontend** (React + Vite): UI no browser.
- **Backend** (Node.js + Express): API para operações administrativas e rotas que não devem rodar no cliente.
- **Supabase**: autenticação e banco (acessado via URL configurada em env).

## 2. Estrutura do Repositório

- **/frontend**: aplicação Vite/React (build gera site estático servido via Nginx no container).
- **/backend**: API Express.
- **docker-compose.yml**: orquestração dos containers do frontend e backend.
- **deploy.py** e **deploy-systemflow.sh**: automação de deploy na VPS.

## 3. Docker Compose (Containers, Rede e Portas)

O [docker-compose.yml](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/docker-compose.yml) usa uma rede Docker **externa** chamada `proxy`. A ideia é que o NGINX Proxy Manager (ou outro reverse-proxy) também esteja conectado nessa rede, e faça o roteamento para os containers pelo **nome do container**.

### Containers

| Serviço | Container | Porta interna | Publicação no Host |
|---|---|---:|---|
| Backend API | `systemflow-backend` | 7005 | não publica porta (apenas `expose`) |
| Frontend Web | `systemflow-frontend` | 80 | não publica porta (apenas `expose`) |

**Observação:** como não há `ports:` no compose, essas portas não ficam expostas diretamente no host. O acesso externo deve acontecer via reverse-proxy conectado à rede `proxy`.

## 4. Variáveis de Ambiente (Padrão Atual)

Este projeto foi padronizado para **não usar `.env` na raiz**.

### Frontend

- Arquivo: [frontend/.env](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/.env)
- Template: [frontend/.env.example](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/.env.example)
- Variáveis usadas no browser precisam ser `VITE_*`:
  - `VITE_SUPABASE_URL` (obrigatória)
  - `VITE_SUPABASE_ANON_KEY` (obrigatória)
  - `VITE_API_URL` (opcional; default no código é `http://localhost:7005`)
  - `VITE_SUPABASE_DEV_PROXY` (opcional; melhora o dev via proxy)
  - `VITE_N8N_API_KEY` (opcional; enviado apenas se existir)

### Backend

- Arquivo: [backend/.env](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/.env)
- Template: [backend/.env.example](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/.env.example)
- Variáveis principais:
  - `SUPABASE_URL` (obrigatória)
  - `SUPABASE_SERVICE_ROLE_KEY` (obrigatória; nunca colocar no frontend)
  - `PORT` (opcional; default 7005)
  - `TZ` (opcional; default `America/Sao_Paulo`)

### Compose (Build do Frontend)

O compose passa `VITE_*` como **build args** do frontend. Como não existe mais `.env` na raiz, o deploy deve rodar com:

```bash
docker compose --env-file backend/.env up -d --build
```

Por isso, no cenário de deploy, o `backend/.env` também contém as variáveis `VITE_*` necessárias ao build do frontend.

## 5. Autenticação e Autorização (Fluxo Real)

### Autenticação (Frontend)

1. O frontend autentica o usuário no Supabase usando `VITE_SUPABASE_ANON_KEY`.
2. O Supabase retorna uma sessão com JWT.
3. Para chamar o backend, o frontend envia `Authorization: Bearer <TOKEN>`.

### Validação (Backend)

O middleware [auth.js](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/src/middleware/auth.js) faz:
1. Lê `Authorization`.
2. Valida o token chamando `supabaseAdmin.auth.getUser(token)`.
3. Busca o `profile` em `public.profiles` e verifica `ativo`.
4. Admin é determinado por `profiles.cargo` (ex.: `ADMIN`).

Além disso, existe um middleware de permissão que usa RPC `has_permission` para RBAC.

## 6. Deploy (VPS)

### Pré-requisitos

- Docker + Docker Compose instalados.
- Um reverse-proxy (ex.: NGINX Proxy Manager) conectado à rede Docker externa `proxy`.
- Arquivo [backend/.env](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/.env) preenchido com os valores corretos (incluindo `VITE_*`).

### Deploy automatizado

O script [deploy.py](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/deploy.py) faz:
- Atualiza o código via `git fetch` + `git reset --hard origin/main`.
- Sobe os containers via `docker compose --env-file ./backend/.env ...`.

## 7. Proxy (NGINX Proxy Manager)

Como os serviços estão na rede `proxy`, o upstream deve apontar para os containers:
- API: `systemflow-backend:7005`
- Web: `systemflow-frontend:80`
