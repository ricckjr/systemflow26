## Visão Geral
- Objetivo: endurecer autenticação, padronizar tipos, corrigir navegação, remover duplicações, otimizar performance e fechar lacunas de segurança (RLS/políticas), elevando o SystemFlow ao padrão SaaS enterprise.
- Base atual mapeada: AuthContext, Router, ProtectedRoute, Supabase Client e páginas principais.

## Achados-Chave
- AuthContext centraliza sessão/perfil/permissões e listeners; há risco de re-subscrição por dependências em efeito. Referências: [AuthContext.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/context/AuthContext.tsx#L111-L180), [loadProfile](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/context/AuthContext.tsx#L34-L106).
- HOC injeta props duplicadas user/currentProfile; padronizar em profile. Referência: [router.tsx:withProfile](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/router.tsx#L46-L65).
- ProtectedRoutes corretas na guarda, mas rotas de “Configurações” não impedem acesso a não-admin. Referência: [ProtectedRoute.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/components/ProtectedRoute.tsx).
- Supabase Client está com persistSession/autoRefresh/detectSessionInUrl corretos. Referência: [supabaseClient.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/supabaseClient.ts#L7-L13).
- RLS: tabelas de social/task/calendar/notifications ok; gaps em profiles (sem RLS) e bucket avatars (UPDATE sem owner/admin). Referências: [500_profiles_avatar.sql](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/db/500_profiles_avatar.sql), [100_storage_instaflow.sql](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/db/100_storage_instaflow.sql).
- Tipos: Profile/Permissao definidos; há usos de any em IAFlow/InstaFlow; duplicação de props nas páginas. Referências: [types.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/types.ts), [IAFlow.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/pages/Comunicacao/IAFlow.tsx#L51-L79), [InstaFlow.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/pages/Comunidade/InstaFlow.tsx#L305-L314).
- Performance: queries duplicadas (CRM), efeitos com deps amplas, listeners instáveis e filtros sem debounce. Referências: [VisaoGeral.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/pages/Comercial/VisaoGeral.tsx#L57-L66), [Oportunidades.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/pages/Comercial/Oportunidades.tsx#L61-L78), [Layout.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/components/Layout.tsx#L119-L127).

## Plano de Implementação

### 1. Autenticação e Sessão
- Corrigir dependências do efeito de inicialização para evitar re-subscrição: useEffect depende só de loadProfile; remover error/profile. Ajustar tratamento de erro para unknown sem any.
- Padronizar aliases no contexto: manter permissions e remover “perms” ou manter apenas como alias documentado; preferir consumo via useAuth nas páginas.
- Garantir fluxo F5: validar persistência via getSession + INITIAL_SESSION sem duplicações; manter isFetchingProfile para evitar races.
- Logout e reset: padronizar limpeza localStorage sb-* no logout (já existe em Layout; mover para ação central). Referências: [AuthContext.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/context/AuthContext.tsx), [Layout.tsx:handleLogout](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow2026/components/Layout.tsx#L137-L147).

### 2. Router e Guardas
- Unificar HOC: renomear para withAuth e injetar apenas profile e permissions; remover user/currentProfile duplicados.
- Introduzir guarda de autorização por rota: ProtectedRoute aceita requisitos (requiredRole/requiredPerm modulo/submodulo) e redireciona com mensagem; aplicar em Usuários e Permissões.
- Manter lazy + Suspense + ErrorBoundary; confirmar que rotas privadas só rendem após loading=false.
- Ajustar AuthCallback para depender do contexto e navegar quando sessão ativa; reduzir chamadas diretas ao supabase.

### 3. Tipos TypeScript Estritos
- Ativar regras estritas no tsconfig (strict, noImplicitAny, strictNullChecks).
- Remover any:
  - AuthContext: catch erro como unknown com narrowing.
  - IAFlow: tipar payload/resposta e objetos manipulados.
  - InstaFlow: tipar comentários conforme schema instaflow_comments.
- Padronizar Page Props: todas páginas privadas recebem profile via HOC/useAuth; remover distinção user vs currentProfile.

### 4. Supabase e Storage
- Confirmar persistência de sessão com autoRefresh/detectSessionInUrl.
- Reset de senha: manter updateUser após type=recovery; exibir erros claros; retorno a /login.
- OAuth callback: confiar em onAuthStateChange; fallback via getSession apenas para erros.
- Storage avatars: atualizar política SQL para exigir owner=auth.uid() OU admin; adicionar DELETE com mesma regra.

### 5. RLS e Políticas
- Habilitar RLS em public.profiles e criar políticas:
  - SELECT: próprio registro ou admin.
  - UPDATE: próprio ou admin.
  - DELETE: opcional, geralmente admin.
- Revisar leitura pública de buckets (instaflow/avatars); manter público se necessário, senão usar signed URLs.
- Criar/validar tabela permissoes/profile_permissoes com RLS consistente; UI deve consumir apenas dados permitidos.

### 6. Serviços e Reuso de Queries
- Extrair services/crm.ts com fetchOportunidades({limit, filtros, order}) e serviços de profiles (fetchProfiles, fetchProfileById).
- Unificar tratamento de timeout/rede com helper withNetworkGuard.

### 7. Performance e UX
- Debounce em buscas de Oportunidades e Usuários (250ms).
- Memoizar agregados de KPIs em Visão Geral; remover reduces inline em render.
- Remover estado derivado em Layout (profileView) e substituir por useMemo; estabilizar listeners com useRef + efeitos [] e leitura por refs.

### 8. Segurança Front-End
- Bloquear acesso às rotas de Configurações/Usuários/Permissões para não-admin via ProtectedRoute com requiredRole.
- Evitar listar perfis para não-admin; onde necessário, usar RPC/edge com verificação.

### 9. Testes e Verificação
- Adicionar testes unitários de AuthContext (init, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) e ProtectedRoute.
- Smoke tests de páginas privadas pós-login (render sem erros, sem “usuários fantasmas”).
- Validar F5: sessão permanece, perfil carrega uma vez, sem corridas.

### 10. Entregáveis
- Refatorações aplicadas e verificadas localmente.
- Scripts SQL para RLS/políticas (profiles, avatars, permissoes).
- Documentação curta de arquitetura: fluxos de auth, contratos de tipos, guardas de rota, serviços compartilhados.

Confirma este plano para executar a refatoração incremental com entregas verificadas em cada etapa?