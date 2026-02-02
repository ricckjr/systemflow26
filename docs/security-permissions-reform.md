# Reforma de Permissões (RLS + RBAC)

## O que foi alterado
- Criado RBAC nativo no banco (perfis, permissoes, vínculos) e função `has_permission`.
- Endurecido o acesso a `profiles` para evitar auto-promoção e reduzir exposição de campos sensíveis.
- Ajustadas as policies de CRM configs para leitura ampla e escrita somente por permissão explícita.
- Consolidada a regra de Clientes/Contatos: ownership por `user_id`, soft delete somente por permissão.
- Backend passou a proteger rotas administrativas por RBAC (`CONFIGURACOES:MANAGE`).
- Frontend passou a carregar permissões via RBAC e aplicar guard por permissão.

## Fonte oficial de migrations
- Única fonte oficial: `backend/src/db/migrations/`.
- SQL legado foi movido para `db/deprecated/` e não deve ser executado.

## Scripts deprecados/removidos
- Deprecados: todos os scripts em `db/` (agora em `db/deprecated/`).
- Substituídos por migration consolidada: `backend/src/db/migrations/20260130_03_rbac_rls_consolidation.sql`.

## Estado final (resumo de RLS/segurança por tabela)
- `public.profiles`
  - SELECT: permitido para autenticados, porém com privilégios de coluna restritos (somente campos públicos).
  - UPDATE: somente o próprio usuário, e somente colunas seguras (nome, avatar, email_corporativo, telefone, ramal).
  - INSERT/DELETE: via backend/service role.
  - Views:
    - `public.profiles_public`: leitura pública (campos seguros).
    - `public.profiles_private`: leitura restrita ao próprio usuário (inclui ativo/email/contato).
- RBAC
  - Tabelas: `public.perfis`, `public.permissoes`, `public.perfil_permissoes`, `public.profile_perfis`.
  - RLS: habilitado, com acesso direto reservado a service role.
  - Funções:
    - `public.has_permission(user_id, modulo, acao)` para enforcement no banco.
    - `public.get_my_permissions()` (RPC) para o frontend carregar permissões do usuário autenticado.
- `public.crm_clientes`
  - SELECT: dono (`user_id=auth.uid()`) ou `CLIENTES:MANAGE`.
  - INSERT: dono ou `CLIENTES:MANAGE`.
  - UPDATE: dono ou `CLIENTES:MANAGE`, e soft delete só com `CLIENTES:DELETE`.
  - DELETE físico: bloqueado por trigger (soft delete via `deleted_at`).
- `public.crm_contatos`
  - SELECT/INSERT/UPDATE: limitado ao vínculo com clientes do usuário; `CLIENTES:MANAGE` tem acesso global.
  - Soft delete: somente com `CLIENTES:DELETE`.
  - DELETE físico: bloqueado por trigger (soft delete via `deleted_at`).
- CRM configs (`public.crm_motivos`, `public.crm_origem_leads`, `public.crm_produtos`, `public.crm_servicos`, `public.crm_verticais`)
  - SELECT: autenticados.
  - INSERT/UPDATE/DELETE: somente `CRM:MANAGE`.

## Checklist de validação (aceite)
- RLS
  - Usuário A não vê cliente do Usuário B.
  - Usuário A não edita cliente do Usuário B.
  - Usuário A não consegue soft delete cliente/contato.
  - Admin (ou perfil com `CLIENTES:MANAGE` + `CLIENTES:DELETE`) vê/edita/exclui (soft delete).
  - Usuário desativado (`profiles.ativo=false`) é bloqueado no backend mesmo com token válido.
- RBAC
  - Usuário sem `CONFIGURACOES:MANAGE` não acessa endpoints `/admin/*`.
  - Troca de perfil do usuário altera permissões após refresh (RPC `get_my_permissions`).
  - CRM configs: leitura ok; escrita somente `CRM:MANAGE`.
- UI
  - Rotas protegidas por `RequirePermission`.
  - Ações proibidas não aparecem e, mesmo forçando requisição, banco/backend bloqueiam.
