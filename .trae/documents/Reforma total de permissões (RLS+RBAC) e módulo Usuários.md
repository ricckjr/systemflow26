## 0) Objetivo (imutável)
- Banco (Supabase/Postgres) vira **fonte de verdade**: RLS consistente, sem policies permissivas em dados sensíveis.
- Evoluir “cargos” → **RBAC completo** (Perfis configuráveis + permissões por módulo/ação) com enforcement end-to-end.
- Consolidar **Clientes + Contatos** com regra: “se não cadastrou, não vê; só admin exclui (soft delete)”.
- Reformar UI: **Configurações → Usuários** com abas **Usuários / Permissões**.
- Backend e Frontend usam RBAC de forma coerente (não apenas esconder botões).

## 1) Diagnóstico (já confirmado no repo)
- Existem duas fontes de SQL: [db/](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/db) (scripts soltos/fix/grant) e [backend/src/db/migrations/](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/src/db/migrations) (versionadas) → estado final por tabela pode divergir.
- `profiles` ainda pode cair em policies permissivas (ex.: [510_profiles_rls.sql](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/db/510_profiles_rls.sql) com `USING(true)`/`WITH CHECK(true)` para UPDATE/DELETE/INSERT) → risco de auto-promoção (`cargo`) e reativação (`ativo`).
- Permissões atuais são “por usuário” (`permissoes` + `profile_permissoes`, ver [database.types.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/types/database.types.ts#L794-L853)), sem modelo de “perfil de acesso” e com enforcement frágil.
- CRM configs (`crm_produtos`, `crm_servicos`, `crm_origem_leads`, etc.) foram criadas com **CRUD aberto** (`FOR ALL USING(true) WITH CHECK(true)`) em [20260129_00_crm_configs.sql](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/src/db/migrations/20260129_00_crm_configs.sql#L55-L116).
- Frontend e backend ainda determinam admin via `profiles.cargo` (ex.: [RequireAdmin.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/routes/guards/RequireAdmin.tsx) e [auth.js](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/src/middleware/auth.js)).
- `profiles` tem campos de presença (`status`, `last_seen`) (ex.: migration [20260115_add_user_status.sql](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/src/db/migrations/20260115_add_user_status.sql)) e trigger `update_updated_at_column()` já usada no schema atual.

## 2) Decisões de arquitetura (não negociáveis)
### 2.1 Fonte única
- Eleger `backend/src/db/migrations/` como **única fonte oficial**.
- Tratar `db/` como **legado**: mover para `db/deprecated/` + README “não rodar / referência histórica”.

### 2.2 Consolidação determinística
- Criar **1 migration de consolidação idempotente** (ou 2 se ficar grande) que:
  - elimina policies/grants conflitantes
  - define o **estado final único** por tabela
  - cria RBAC novo + seed
  - migra suavemente do modelo atual para o novo

## 3) Regras de negócio (não negociáveis)
- Usuário comum: vê/edita apenas o que cadastrou (`user_id`); não exclui nada; não descobre dados de terceiros.
- Admin: vê/edita tudo e faz soft delete de clientes/contatos; é o único que gerencia usuários e RBAC.

## 4) Banco — RBAC (modelo alvo)
### 4.1 Novo contrato (tabelas)
- Criar:
  - `perfis(perfil_id uuid pk, perfil_nome unique, perfil_descricao, created_at, updated_at)`
  - `permissoes(permissao_id uuid pk, modulo text, acao text, descricao, created_at, updated_at, UNIQUE(modulo,acao))`
  - `perfil_permissoes(perfil_id, permissao_id, pk(perfil_id,permissao_id))`
  - `profile_perfis(user_id uuid pk, perfil_id fk)` (fase 1: 1 usuário = 1 perfil)

### 4.2 Função padrão
- Criar `has_permission(user_id uuid, modulo text, acao text) returns boolean` (STABLE) baseada **somente** em `profile_perfis → perfil_permissoes → permissoes`.

### 4.3 Seed inicial
- Criar perfil `ADMIN` com todas permissões.
- Criar perfis mínimos: `VENDEDOR`, `FINANCEIRO`, `PRODUCAO` com permissões mínimas.

### 4.4 Migração suave do legado
- Renomear para evitar colisão com novo contrato:
  - `permissoes` → `legacy_permissoes`
  - `profile_permissoes` → `legacy_profile_permissoes`
- Popular `profile_perfis` via `profiles.cargo` (bootstrap): `ADMIN` → perfil ADMIN; demais → perfil padrão.

## 5) Banco — Hardening de `profiles`
### 5.1 Schema preservado
- Preservar/garantir campos atuais: `cargo (cargo_enum)`, `ativo`, `status`, `last_seen`, índices `idx_profiles_email_login`, `idx_profiles_nome`, trigger `trg_profiles_updated_at` usando `update_updated_at_column()`.

### 5.2 Política final (anti auto-promoção)
- SELECT: permitir o necessário para UI/chat.
- UPDATE: apenas o próprio usuário e apenas campos seguros (ex.: `nome`, `avatar_url`, `email_corporativo`, `telefone`, `ramal`).
- INSERT/DELETE: somente service_role/backend.

### 5.3 Restrição de colunas seguras (preferência)
- **Preferido**: criar `public.profiles_public` (VIEW) com colunas seguras e migrar queries do frontend (e onde aplicável do backend) para usar a view.
- **Fallback** (se não quebrar o app): usar GRANT por coluna + RLS.

## 6) Banco — Clientes + Contatos (regra definitiva)
### 6.1 `clientes`
- Manter unique parcial por soft delete para `cliente_documento` (já existe).
- RLS final:
  - usuário: SELECT/UPDATE apenas `user_id=auth.uid()` e `deleted_at is null`
  - INSERT: `user_id` garantido como `auth.uid()` (trigger/policy)
  - soft delete (`deleted_at=now()`): somente `has_permission(auth.uid(),'CLIENTES','DELETE')` (seed: só ADMIN)

### 6.2 `clientes_contatos`
- RLS final:
  - SELECT: usuário vê **todos contatos** dos clientes dele via join em `clientes.user_id=auth.uid()` e `deleted_at is null`
  - INSERT: só cria contato para cliente dele (EXISTS)
  - UPDATE: recomendado para consistência: usuário edita contatos do cliente dele
  - soft delete: somente `has_permission(auth.uid(),'CLIENTES','DELETE')`

## 7) Banco — CRM configs
- Substituir `FOR ALL USING(true) WITH CHECK(true)` por:
  - SELECT: authenticated
  - INSERT/UPDATE/DELETE: `has_permission(auth.uid(),'CRM','MANAGE')` (seed: ADMIN)

## 8) Backend — coerência e segurança
- Manter autenticação (token) e bloqueio por `profiles.ativo`.
- Remover “admin por cargo” nas rotas sensíveis:
  - criar middleware `requirePermission(modulo, acao)` consultando RBAC.
- Rotas admin exigem `CONFIGURACOES:MANAGE`.
- Endpoints admin obrigatórios:
  - usuários: listar/editar/ativar/desativar
  - atribuir perfil RBAC (`profile_perfis`)
  - perfis: CRUD
  - vínculo perfil↔permissões (`perfil_permissoes`) + catálogo de permissões (`permissoes`)

## 9) Frontend — Configurações → Usuários (2 abas)
- Unificar tela em uma página com tabs:
  - **Usuários** (default): lista + atribuição de perfil + ativa/desativa; apenas `CONFIGURACOES:MANAGE`.
  - **Permissões**: CRUD de `perfis` + checklist (modulo,acao) para `perfil_permissoes`; apenas `CONFIGURACOES:MANAGE`.
- Enforcement:
  - criar `<RequirePermission modulo acao>` e `can(modulo,acao)`.
  - AuthContext passa a carregar RBAC novo (perfil do usuário + permissões do perfil), deixando o legado para trás.
- CRM configs UI (ex.: [Produtos.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/crm/configs/Produtos.tsx)) passa a exigir `CRM:MANAGE` para ações de escrita.

## 10) Ordem de execução (implementação)
1. Criar migration(s) de consolidação (RBAC + hardening + RLS final por tabela).
2. Deprecar `db/` (mover para `db/deprecated/` + README).
3. Refatorar backend para RBAC (`requirePermission`) e novos endpoints.
4. Refatorar frontend (AuthContext RBAC + RequirePermission + nova área Usuários com tabs).
5. Adicionar relatório final + checklist executável (scripts/roteiro de validação).

## 11) Entregáveis e critérios de aceite
- Migrations consolidadas com estado final único por tabela (sem mix).
- Relatório curto (markdown): mudanças + scripts deprecados + resumo RLS por tabela.
- Checklist validando:
  - A não vê/edita B (clientes/contatos)
  - A não exclui; Admin soft delete ok
  - desativado bloqueado
  - CRM configs: read ok; write só ADMIN
  - UI bloqueia e banco/back também bloqueiam por enforcement.

Se este plano estiver ok, eu parto para a implementação completa na próxima etapa (migrations + backend + frontend + relatório + checklist).