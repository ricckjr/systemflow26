## Objetivo
Otimizar e profissionalizar o código da página `Perfil.tsx`, melhorando a legibilidade, performance e UX.

## Melhorias Planejadas

1.  **Correção de Estilos (UI/UX)**:
    -   Substituir a classe `input` (que não existe) pelas classes utilitárias completas do Tailwind usadas no padrão do sistema (estilo "industrial"), garantindo consistência com a página de Usuários.
    -   Classes a usar: `w-full px-4 py-2.5 border border-industrial-border bg-industrial-bg rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-white placeholder:text-industrial-text-secondary transition-all`.
    -   Adicionar funcionalidade de **Mostrar/Ocultar Senha** nos campos de alteração de senha.

2.  **Refatoração e Otimização de Código**:
    -   **Extração de Lógica**: Separar a lógica de upload de avatar em uma função `uploadAvatar` dedicada para limpar o `handleSubmit`.
    -   **Validação Centralizada**: Melhorar a validação de formulário e imagem.
    -   **Feedback de Usuário**: Adicionar *toasts* ou mensagens de feedback mais elegantes para sucesso/erro.

3.  **Refinamento das Funções**:
    -   `handleSubmit`: Otimizar o fluxo de upload + update para evitar condições de corrida.
    -   `isValidImage`: Manter a verificação robusta de magic numbers.
    -   `changePassword`: Melhorar a validação e limpar campos após sucesso.

4.  **Organização Visual**:
    -   Manter o layout em cards ("Resumo" removido conforme solicitado anteriormente, foco no Formulário e Senha).
    -   Adicionar ícones de loading nos botões de ação.

## Arquivos Afetados
-   `pages/Configuracoes/Perfil.tsx`

## Passos de Execução
1.  Reescrever `Perfil.tsx` implementando as melhorias de código e estilo.
2.  Testar o fluxo de upload de avatar e alteração de senha (validação de código).