## Objetivo
Otimizar e refatorar o arquivo `router.tsx` para melhorar a organização, legibilidade e manutenibilidade, implementando High-Order Components (HOCs) para injeção de dependências (perfil/permissões) e padronizando o layout.

## Etapas de Implementação

1.  **Estrutura de Arquivos**
    -   Criar `layouts/AppLayout.tsx`: Será um wrapper simples que renderiza o `components/Layout.tsx` atual. Isso alinha o projeto com o padrão de diretórios sugerido pelo usuário (`layouts/`).
    -   Criar `pages/AuthCallback.tsx`: Página de callback para autenticação (ex: OAuth), mesmo que seja apenas um placeholder inicial que redireciona para `/app`, para evitar erros 404 em fluxos futuros.

2.  **Refatoração do Router (`router.tsx`)**
    -   **Code Splitting**: Manter o uso de `lazy` para todas as páginas pesadas.
    -   **HOC `withProfile`**: Criar um HOC genérico que verifica o `profile` do `useAuth` e renderiza um Loader caso esteja nulo, ou o componente com as props injetadas (`user`, `currentProfile`, `perms`) caso carregado.
        -   *Atenção*: As páginas atuais usam nomes de props diferentes (`user` vs `currentProfile`). O HOC deve ser flexível ou devemos padronizar (o HOC injetará ambas ou faremos wrappers específicos).
    -   **Componente `Loader`**: Extrair o loader inline para um componente reutilizável dentro do arquivo ou importado.
    -   **Organização**: Agrupar rotas por domínio (Auth, Comunidade, Comercial, etc.).

3.  **Correções e Melhorias**
    -   Remover lógica repetitiva de `React.createElement` e verificações de `if (!profile) return ...` dentro de cada rota, movendo isso para o HOC.
    -   Adicionar tipagem TypeScript explícita para o HOC.

## Arquivos a Criar/Modificar
-   `router.tsx` (Refatoração completa)
-   `layouts/AppLayout.tsx` (Novo)
-   `pages/AuthCallback.tsx` (Novo)

## Testes e Validação
-   Verificar se a navegação para `/app` carrega o layout corretamente.
-   Verificar se páginas que exigem perfil (`InstaFlow`, `Usuarios`) não quebram e recebem os dados.
-   Validar o fluxo de `lazy loading` (não deve haver tela branca, apenas o loader).