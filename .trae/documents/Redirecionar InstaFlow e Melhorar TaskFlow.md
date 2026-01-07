## Contexto Atual
- App já redireciona pós-login para `'/comunidade'` via `<Navigate>`.
- Rotas ativas: `'/comunidade'` → `InstaFlow`, `'/comunidade/taskflow'` → `TaskFlow`.
- Importações em `App.tsx` apontam para `pages/Comunidade/InstaFlow` e `pages/Comunidade/TaskFlow`.
- Navegação lateral ainda usa `'/instaflow'` e `'/instaflow/taskflow'` (inconsistente com as rotas).

## Ações para InstaFlow (pós-login)
1. Confirmar redirecionamento automático: manter `<Route path="/login" element={!session ? <Login /> : <Navigate to="/comunidade" />} />`.
2. Corrigir navegação lateral: atualizar `components/Layout.tsx` para usar `'/comunidade'` e `'/comunidade/taskflow'` em “COMUNIDADE FLOW”.
3. Tratamento de erro ao carregar página:
   - Migrar imports para `React.lazy` com `Suspense` e um `ErrorBoundary` simples em `App.tsx` para exibir fallback quando o módulo não puder ser carregado.
   - Fallback mostra mensagem amigável e link para tentar novamente.

## Melhorias em TaskFlow
1. Performance
   - Extrair `TaskCard` em componente memoizado e usar `React.memo` para reduzir re-render em drag.
   - `useMemo` para `selectedTask` e evitar múltiplos `find` por render.
   - Debounce no input de busca (200–300ms) e memo de lista filtrada (quando for implementado filtro real).
2. Usabilidade
   - Atalhos: `N` abre “Nova Tarefa”; `F` foca busca; `Esc` já fecha modais.
   - AutoFocus adequado e persistência de última coluna usada ao criar tarefa.
   - Melhorar barra de filtros com estado e callbacks (mesmo se visual inicialmente).
3. Visual
   - Adaptar para tema “glass + azul” (cores e blur alinhados ao Login): painéis, modais e chips.
   - Estados vazios com ícones e mensagens consistentes.
4. Robustez
   - `try/catch` em todas chamadas `services/taskflow` com mensagens de erro visíveis.
   - Loading/skeleton para colunas na inicialização.

## Verificação
- Desenvolver em ambiente local, validar:
  - Login → redireciona para `'/comunidade'` com `InstaFlow` carregado.
  - Navegação lateral abre InstaFlow/TaskFlow pelas novas rotas.
  - TaskFlow: criar tarefa, drag-and-drop, comentários, atalhos.

## Documentação
- Adicionar entradas em `docs/CHANGELOG.md` descrevendo:
  - Ajuste de rotas na Comunidade.
  - Lazy loading e fallback de erro para páginas da Comunidade.
  - Melhorias de performance/UX no TaskFlow.

Confirma que posso aplicar essas mudanças agora? 