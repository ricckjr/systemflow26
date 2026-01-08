# Plano de Reestruturação "Execução Sem Dor" SystemFlow

## 1. Visão Geral

Este plano segue a estratégia de **8 commits seguros**, priorizando a estabilidade do sistema através de movimentações graduais com retrocompatibilidade (re-exports) e uma identidade visual "Enterprise Dark" refinada.

## 2. Definições Visuais (Enterprise Dark)

Adotaremos a paleta "Near-Black" para profundidade e elegância:

* **Main Background:** `#0B0F14` (Quase preto)

* **Panel Background:** `#0F172A` (Escuro elegante)

* **Card Background:** `#111827`

* **Primary (Brand):** `#38BDF8` (Sky Blue)

  * `600`: `#0284C7`

  * `700`: `#0369A1`

  * `Soft`: `rgba(56, 189, 248, 0.12)`

* **Text:** `#E5E7EB`

* **Muted:** `#9CA3AF`

* **Border:** `rgba(255, 255, 255, 0.08)`

## 3. Plano de Execução (8 Etapas)

### Commit 1: Estrutura e Barrel Exports

**Objetivo:** Preparar o terreno sem mover arquivos.

* Criar pastas: `src/routes/guards`, `src/components/layout`, `src/components/ui`, `src/contexts`, `src/styles`.

* Criar arquivos `index.ts` (barrel) nessas pastas para facilitar imports futuros.

### Commit 2: Refatoração do Router

**Objetivo:** Mover o roteamento central.

* Mover `router.tsx` -> `src/routes/index.tsx`.

* Atualizar `App.tsx` para importar do novo local.

* Garantir que a aplicação inicie normalmente.

### Commit 3: Consolidação do AuthContext

**Objetivo:** Eliminar duplicidade mantendo compatibilidade.

* Consolidar lógica em `src/contexts/AuthContext.tsx`.

* Transformar `src/components/AuthContext.tsx` e `src/context/AuthContext.tsx` (antigo) em arquivos de re-export (`export * from ...`) para não quebrar imports existentes.

### Commit 4: Refatoração de Guards

**Objetivo:** Organizar proteção de rotas.

* Mover `ProtectedRoute.tsx` -> `src/routes/guards/ProtectedRoute.tsx`.

* Manter re-export no local antigo.

### Commit 5: Tema e Estilização (Visual)

**Objetivo:** Aplicar a nova identidade visual.

* Criar/Atualizar `src/styles/theme.css` com as variáveis CSS definidas.

* Atualizar `tailwind.config.ts` para mapear as novas cores (`brand`, `navy`, etc).

* Ajustar `index.css` / `style.css` para usar as novas variáveis no `body`.

### Commit 6: Refatoração de Layout

**Objetivo:** Performance e Modularização.

* Quebrar `Layout.tsx` em:

  * `src/components/layout/Sidebar.tsx`

  * `src/components/layout/Header.tsx`

  * `src/components/layout/MainLayout.tsx`

* Isolar estado do menu mobile para evitar re-renders globais.

### Commit 7: Correção de Lógica de Auth

**Objetivo:** Estabilidade e Segurança.

* Refinar `AuthContext`:

  * Garantir loading state real.

  * Apenas 1 listener do Supabase.

  * Remover fallback de "perfil fake" (falhar graciosamente).

* Refinar `ProtectedRoute`:

  * Loader enquanto `loading`.

  * Redirect para login se sem sessão.

### Commit 8: Limpeza de Tipos

**Objetivo:** Organização final.

* Dividir `types.ts` em `src/types/auth.ts`, `src/types/domain.ts`, `src/types/ui.ts`.

* Atualizar imports gradualmente.

* Remover `any` críticos.

## 4. Próximos Passos

Aguardando confirmação para iniciar com o **Commit 1**.

Você é o TRAE, arquiteto sênior de software, auditor de código e release engineer.
Atue com nível enterprise SaaS.

Você deve EXECUTAR o plano abaixo, começando AGORA pelo COMMIT 1.
Não peça confirmação, não antecipe commits futuros, não faça mudanças fora do escopo do commit atual.

\================================================
REGRAS ABSOLUTAS
================

* NÃO quebrar o sistema
* NÃO remover funcionalidades
* NÃO mudar regras de negócio
* NÃO alterar Supabase queries/RLS/policies/tabelas/colunas
* NÃO alterar comportamento de autenticação (somente endurecer no Commit 7)
* Mudanças estruturais devem manter retrocompatibilidade via re-exports/adapters
* Um commit = um escopo. Sem “refactor extra”.

\================================================
IDENTIDADE VISUAL (será aplicada no Commit 5)
=============================================

Main Background: #0B0F14
Panel Background: #0F172A
Card Background: #111827
Primary: #38BDF8 (600 #0284C7, 700 #0369A1, Soft rgba(56,189,248,0.12))
Text: #E5E7EB
Muted: #9CA3AF
Border: rgba(255,255,255,0.08)

\================================================
PLANO EM 8 COMMITS
==================

COMMIT 1: Estrutura e Barrel Exports (EXECUTAR AGORA)
Objetivo: preparar o terreno sem mover arquivos.

* Criar pastas:
  src/routes/guards
  src/components/layout
  src/components/ui
  src/contexts
  src/styles

* Criar arquivos index.ts (barrel exports) dentro de:
  src/routes
  src/routes/guards
  src/components
  src/components/layout
  src/components/ui
  src/contexts
  src/styles

Regras do Commit 1:

* NÃO mover arquivos existentes.
* NÃO alterar imports existentes.
* Somente criar estrutura/pastas e barrels.
* Se uma pasta já existir, apenas adicionar o index.ts sem quebrar nada.

Critérios de aceite do Commit 1:

* Build continua funcionando
* Nenhuma rota/auth afetada
* Sem erros novos no console

COMMIT 2: Router -> src/routes/index.tsx
COMMIT 3: Consolidar AuthContext em src/contexts + re-exports nos locais antigos
COMMIT 4: ProtectedRoute -> src/routes/guards + re-export no local antigo
COMMIT 5: Tema: src/styles/theme.css + tailwind mapping + base body/layout
COMMIT 6: Quebrar Layout.tsx em Sidebar/Header/MainLayout (isolando state mobile)
COMMIT 7: Corrigir loop de auth/loading: 1 listener supabase + loading real + ProtectedRoute com loader/redirect
COMMIT 8: types.ts -> src/types/auth.ts domain.ts ui.ts + remover any críticos

\================================================
FORMATO DE ENTREGA (OBRIGATÓRIO)
================================

Para ESTE commit (1), entregue:

1. Lista exata de pastas/arquivos criados
2. Conteúdo completo de cada index.ts criado
3. Qualquer observação de conflito (se já existia)
4. Confirmação objetiva dos critérios de aceite do commit

INICIAR AGORA PELO COMMIT 1.
