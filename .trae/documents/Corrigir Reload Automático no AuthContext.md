# Correção de Reload/Reset Indevido ao Perder Foco

## Análise do Problema
O comportamento de "reload" (tela de carregamento aparecendo e resetando o estado) ao trocar de aba ou minimizar o navegador é causado pela revalidação automática de sessão do Supabase.

1.  O cliente Supabase (`autoRefreshToken: true`) verifica a sessão ao retomar o foco da janela.
2.  O evento `onAuthStateChange` é disparado (mesmo se o usuário for o mesmo).
3.  No `AuthContext.tsx`, o callback deste evento define incondicionalmente `setProfileReady(false)`.
4.  Isso faz com que o `ProtectedRoute` desmonte a aplicação e mostre o loader, perdendo todo o estado (modais, formulários, scroll).

## Plano de Implementação

### 1. Modificar `frontend/src/contexts/AuthContext.tsx`
O objetivo é evitar que `setProfileReady(false)` seja chamado se o usuário não mudou.

*   **Adicionar `useRef` para rastrear a sessão atual**:
    *   Criar `const sessionRef = useRef<Session | null>(null)` para manter a referência da sessão sem depender de closures ou re-renderizações.

*   **Atualizar `onAuthStateChange`**:
    *   Comparar o ID do usuário da nova sessão (`newSession?.user?.id`) com a sessão anterior (`sessionRef.current?.user?.id`).
    *   **Só resetar o estado (`setProfileReady(false)`) se o usuário mudou.**
    *   Se for o mesmo usuário (apenas refresh de token ou foco na janela), manter o estado atual e evitar o "reload" visual.

*   **Sincronizar `sessionRef`**:
    *   Atualizar `sessionRef.current` sempre que `setSession` for chamado (no `onAuthStateChange` e na inicialização via `getSession`).

### 2. Validação
*   Simular o cenário de troca de aba/perda de foco.
*   Verificar se o loader *não* aparece mais.
*   Verificar se o estado (ex: um modal aberto) é preservado.
*   Garantir que Login e Logout continuem funcionando corretamente.

## Arquivos Afetados
*   `frontend/src/contexts/AuthContext.tsx`
