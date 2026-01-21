## Objetivo
- Adicionar o módulo **Produção** ao app (menu + rotas + páginas), com **Kanban OMIE** dinâmico e drag & drop que persiste `status_proposta` e `updated_at` na tabela `public.omie_servics`.

## Navegação (Menu + Rotas + Título)
- Incluir o item **PRODUÇÃO** no menu em [Sidebar.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Sidebar.tsx), com subitens:
  - **OMIE** → `/app/producao/omie`
  - **Serviços** → `/app/producao/servicos`
  - **Equipamentos** → `/app/producao/equipamentos`
- Registrar as rotas protegidas em [routes/index.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/routes/index.tsx) via `React.lazy` seguindo o padrão já usado.
- Atualizar o mapeamento de títulos do header em [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx) para exibir “PRODUÇÃO / OMIE / SERVIÇOS / EQUIPAMENTOS” de forma consistente.

## Tipos (Supabase tipado)
- Atualizar [database.types.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/types/database.types.ts) para incluir `public.Tables.omie_servics` (Row/Insert/Update) com os campos fornecidos.
  - Motivo: o client Supabase é tipado e hoje `omie_servics` não existe no tipo, o que impede `.from('omie_servics')` sem casting.

## Camada de Serviços (DB)
- Criar `src/services/omieServics.ts` com funções focadas em I/O:
  - `fetchOmieServics()` (select ordenado, retornando lista)
  - `updateOmieServicStatus(id_omie, nextStatus)` (update de `status_proposta` + `updated_at`)
  - (Opcional) helpers para normalização de status e/ou mapeamento de “sem status”.

## Hooks (estado + realtime)
- Criar `src/hooks/useOmieServics.ts` para:
  - Carregar dados iniciais (1 fetch) para estado local.
  - Assinar realtime (`postgres_changes`) em `omie_servics` e aplicar patches locais (INSERT/UPDATE/DELETE) sem refetch.
  - Expor `items`, `setItems`, `loading`, `error`, `refresh()` (manual) para as páginas.
  - Evitar loops: updates do realtime só fazem merge idempotente por `id_omie`.

## UI — OMIE Kanban
- Criar página `src/pages/Producao/OmieKanban.tsx`:
  - Kanban usando `@hello-pangea/dnd` (mesma lib e padrão do [TaskFlow.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunidade/TaskFlow.tsx)).
  - Colunas geradas dinamicamente a partir de `status_proposta` (com tratamento para `null`/vazio como “SEM STATUS”).
  - Cards exibem dados essenciais (ex.: `cod_proposta`, `cliente`, `vendedor`, `solucao`, `valor_proposta`, `data_entrega`, `dias_abertos`, `a_prazo`).
  - Drag & drop:
    - Atualiza **estado local** imediatamente (otimista).
    - Persiste no banco (`status_proposta` + `updated_at`).
    - Rollback em caso de erro (padrão similar ao `moveTaskToColumn` do TaskFlow).
  - Barra superior com UI já preparada para:
    - Busca por `cod_proposta`.
    - Filtros em memória por `vendedor`, `cliente`, `empresa_correspondente`.

## UI — Serviços (lista/tabela)
- Criar `src/pages/Producao/Servicos.tsx`:
  - Tabela responsiva com as principais colunas da `omie_servics`.
  - Mesmos filtros e busca (reuso do hook) + paginação simples (se necessário) para manter performance.

## UI — Equipamentos (scaffold)
- Criar `src/pages/Producao/Equipamentos.tsx` como página inicial vazia (estrutura e layout prontos), deixando ganchos para evolução.

## Performance e Reatividade (garantias)
- Sem “reload automático”: 1 fetch inicial + realtime incremental.
- Derivações pesadas (colunas, agrupamento, filtros) em `useMemo` e callbacks estáveis (`useCallback`).
- Ordenação consistente e estável dentro de cada coluna (ex.: por `updated_at` desc).

## Validação
- Verificar navegação: menu → rotas → título.
- Verificar Kanban:
  - Colunas dinâmicas conforme status existente.
  - Drag & drop atualiza UI instantaneamente e persiste no banco.
  - Realtime reflete mudanças feitas em outra aba/usuário.
- Rodar build/typecheck do frontend para garantir que `database.types.ts` e imports estão corretos.