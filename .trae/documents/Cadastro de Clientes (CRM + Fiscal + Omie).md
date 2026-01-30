## Requisitos Confirmados
- Criar modelagem profissional da tabela `public.clientes` com snake_case, sem acentos, soft delete, auditoria, compatível com Supabase/Postgres.
- Criar ENUMs no banco para `cliente_tipo_pessoa` e `cliente_regime_tributario`.
- Validar `cliente_documento` por tipo (11 CPF / 14 CNPJ) no banco.
- Preparar `integ_id` para integração ERP (ex.: Omie).
- Criar trigger `updated_at`.
- Sugerir políticas RLS (admin total; usuário comum só o que cadastrou; bloquear `deleted_at IS NOT NULL`).
- Implementar a página [Clientes.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Cadastros/Clientes.tsx) com UI SaaS, completa.

## Levantamento do Estado Atual
- `Clientes.tsx` e páginas de cadastro estão como placeholder “Em breve”.
- Não existe tabela `clientes` versionada em migrations.
- O projeto já usa RLS em alguns módulos (muito permissivo em `profiles`) e tem padrão de trigger `set_updated_at()` em scripts do `db/`.

## Modelagem Proposta (Banco)
- Criar ENUMs:
  - `public.cliente_tipo_pessoa_enum`: `('FISICA','JURIDICA')`
  - `public.cliente_regime_tributario_enum`: `('SIMPLES_NACIONAL','LUCRO_PRESUMIDO','LUCRO_REAL')`
- Criar tabela `public.clientes` com os campos do seu “estrutura definitiva”, adicionando defaults e constraints:
  - PK: `cliente_id uuid primary key default uuid_generate_v4()` (com `uuid-ossp`)
  - `integ_id text` (opcional) + índice/unique parcial (onde `deleted_at is null`)
  - Identificação/CRM/Fiscal/Endereço conforme especificação
  - `cliente_tags` conforme sua lista; recomendação: manter `text[]` como pedido e adicionar validação opcional (ou evoluir para enum array numa segunda etapa)
  - Auditoria: `user_id uuid references auth.users(id)`, `created_at`, `updated_at`, `deleted_at`
- Constraints/validações:
  - Documento: regex por tipo (somente dígitos; 11/14)
  - `cliente_documento` unique parcial (`deleted_at is null`)
  - `cliente_uf` com `char_length=2` + uppercase
- Trigger:
  - Criar (ou reutilizar) `public.set_updated_at()` + trigger `BEFORE UPDATE` para setar `updated_at = now()`
  - Opcional: trigger para normalizar `cliente_documento` removendo caracteres não numéricos.

## RLS (Sugestão Implementável)
- `ENABLE ROW LEVEL SECURITY` em `public.clientes`.
- Policies sugeridas:
  - `SELECT`: `deleted_at is null AND user_id = auth.uid()` para `authenticated`
  - `INSERT`: `user_id = auth.uid()` (e `deleted_at is null`) para `authenticated`
  - `UPDATE`: `deleted_at is null AND user_id = auth.uid()` para `authenticated`
  - `DELETE`: preferir soft delete via update; opcionalmente bloquear delete físico para `authenticated`.
  - “Admin total”: conceder `FOR ALL TO service_role USING (true) WITH CHECK (true)` (admin via backend/service role). Se vocês tiverem um “papel admin” em `profiles/permissoes`, dá para expandir depois com `EXISTS(...)`.

## Migrations (Entrega)
- Adicionar migration nova no padrão do repo (SQL puro) contendo:
  - `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
  - Criação idempotente dos ENUMs via `DO $$ ... $$`
  - `CREATE TABLE IF NOT EXISTS public.clientes (...)`
  - Índices/unique parciais
  - Trigger function + trigger `updated_at`
  - Policies RLS

## Frontend (Serviços + Página)
- Criar funções em [crm.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/services/crm.ts) ou um `clientes.ts` dedicado:
  - `fetchClientes({ search, includeDeleted? })`
  - `createCliente(payload)`
  - `updateCliente(clienteId, updates)`
  - `softDeleteCliente(clienteId)` (seta `deleted_at`)
- Implementar [Clientes.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Cadastros/Clientes.tsx) como CRUD profissional:
  - Lista com busca (nome/documento/email)
  - Modal de criação/edição com seções (Identificação, Contato, Endereço, Fiscal, Presença Digital, CRM)
  - Validação de CPF/CNPJ (máscara e tamanho) no frontend + mensagens claras
  - Tags (CLIENTE/FORNECEDOR) com seleção simples
  - Ação “Arquivar” (soft delete) em vez de delete físico

## Ajustes de Tipagem (Supabase)
- Atualizar [database.types.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/types/database.types.ts) para incluir `clientes` e os novos enums (ou manter chamadas com `supabase as any` caso vocês prefiram não versionar tipagem agora).

## Verificação
- Rodar build do frontend (`npm run build`) e checar diagnostics TypeScript.
- Validar SQL (sem dependências de tabelas ainda não criadas) e idempotência.

## Observações / Melhorias Recomendadas (sem quebrar sua estrutura)
- `integ_id`: opcionalmente acrescentar `integ_source` e `integ_payload jsonb` (útil para Omie e auditoria de integração).
- `cliente_vertical` e `cliente_origem_lead`: hoje seu modelo pede texto; quando vocês quiserem padronizar com as tabelas de Configs CRM, dá para evoluir para FKs (`vert_id/orig_id`) sem perder histórico.

Se aprovar este plano, eu implemento as migrations + serviços + UI do cadastro de Clientes de ponta a ponta.