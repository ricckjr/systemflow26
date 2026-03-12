# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SystemFlow** is a full-stack business operations platform for **Apliflow**, with modules for CRM, Sales, Production, Logistics, Finance, HR, and internal collaboration. The UI is in Portuguese.

## Development Commands

### Frontend (`/frontend`)
```bash
npm run dev          # Vite dev server on port 3000
npm run build        # Production build
npm run dev:clean    # Clean Vite cache and restart
```

### Backend (`/backend`)
```bash
npm run dev          # Nodemon watch (port 7005)
npm start            # Production server
npm run seed:ncm     # Seed NCM codes into database
```

### Deployment
```bash
python deploy.py     # git reset hard + docker compose down/build/up
docker compose --env-file ./backend/.env up -d
```

## Architecture

### Stack
- **Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS 4, React Router 7, React Query 5, Supabase JS
- **Backend:** Node.js 18, Express 4, Supabase Admin client
- **Database/Auth:** Supabase (PostgreSQL + Auth)
- **Deployment:** Docker Compose + NGINX Proxy Manager (`proxy` external network)

### Frontend Structure (`/frontend/src/`)
- **`pages/`** — Route-level components organized by domain (CRM, Producao, Financeiro, Comunidade, etc.)
- **`components/`** — Reusable UI grouped by domain and generic `ui/` folder
- **`services/`** — All Supabase and backend API calls; largest files are `crm.ts` (72KB), `chat.ts` (32KB), `taskflow.ts` (20KB)
- **`contexts/`** — Global state: `AuthContext`, `NotificationsContext`, `PresenceContext`, `ToastContext`, `ChatNotificationsContext`
- **`hooks/`** — Domain logic hooks (useChat, useCRM, useTheme, useUnsavedChangesGuard, etc.)
- **`routes/index.tsx`** — Full React Router config with lazy-loaded pages and route guards
- **`types/database.types.ts`** — Auto-generated Supabase schema types (source of truth for DB shape)

### Backend Structure (`/backend/src/`)
- **`index.js`** — Express app with middleware stack: Helmet → CORS → Body Parser → Morgan → Routes
- **`middleware/auth.js`** — JWT validation via `supabaseAdmin.auth.getUser(token)`, profile lookup with 30s cache, RBAC checks
- **`routes/`** — `admin.js`, `taskflow.js`, `estoque.js`, `debug.js`

### State Management
- **Auth/session:** `AuthContext` wrapping Supabase session (stored as `systemflow-auth-token` in localStorage)
- **Server cache:** React Query — `staleTime: 5min`, `gcTime: 30min`, refetch on window focus/mount disabled
- **Real-time:** Supabase Realtime subscriptions in `services/realtime.ts` with exponential backoff reconnect
- **UI state:** `useState` + Toast/Notifications contexts

### Authentication & RBAC
- Frontend sends JWT as `Authorization: Bearer <token>` to backend
- Backend verifies via Supabase Admin, attaches `{ user, profile }` to request
- Permissions checked via Supabase RPC: `has_permission(user_id, modulo, acao)`
- Modulos follow pattern `PAGINA__DOMAIN__FEATURE`, acoes: `VIEW`, `EDIT`, `DELETE`, `CONTROL`
- Admin determined by `profiles.cargo = 'ADMIN'`

### Routing
- All authenticated routes nested under `/app` inside `ProtectedRoute`
- Pages are `React.lazy()` loaded with Suspense fallbacks
- `RequirePermission` wrapper enforces RBAC on specific routes
- Preview-only routes use `ProtectedNoLayoutRoute` (no sidebar/header)

## Environment Variables

**Frontend** (build-time, `VITE_` prefix):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` — defaults to `/api` if unset
- `VITE_N8N_API_KEY`, `GEMINI_API_KEY` (optional)

**Backend** (runtime, `/backend/.env`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (default: 7005), `NODE_ENV`, `TZ` (default: `America/Sao_Paulo`)
- `CORS_ORIGINS` — comma-separated allowed origins

In Docker builds, `VITE_*` vars must also be in the root `.env` for build args to be passed to the frontend container.

## Key Conventions

- **Language:** All UI text, variable names in business domain, and database fields are in Portuguese
- **Dark theme:** Default; CSS variables control theming, toggled via `useTheme` hook
- **API calls:** Frontend uses `services/api.ts` (Axios wrapper) for backend calls and `services/supabase.ts` for direct DB queries
- **Types:** Business domain types in `types/domain.ts`; DB types from `types/database.types.ts` (auto-generated, do not edit manually)
- **Icons:** Lucide React exclusively
- **Permissions guard:** Use `RequirePermission` component in routes or `useAuthContext` hook for conditional rendering
