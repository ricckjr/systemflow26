## Objetivo
Implementar um sistema completo e seguro de redefinição de senha para o Supabase Self-Hosting, incluindo banco de dados, frontend e instruções de configuração.

## Etapas de Implementação

1.  **Banco de Dados (Migration)**
    -   Criar arquivo SQL `db/600_password_reset.sql`.
    -   Definir tabela `auth.password_reset_tokens` com segurança RLS (apenas service_role pode ler/escrever para evitar vazamento).
    -   Adicionar índices para performance.
    -   *Nota*: Como não temos acesso direto ao `auth` schema em migrations comuns do Supabase Client, criaremos no schema `public` e faremos referências seguras, ou instruiremos o uso de SQL Editor. **Decisão:** Usar schema `public` para a tabela de tokens para facilitar o acesso via API, mas com RLS estrito.

2.  **Configuração de Ambiente (.env)**
    -   Adicionar variáveis de exemplo para SMTP no `.env` (usuário deve preencher).
    -   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER`.

3.  **Frontend: Páginas de Fluxo**
    -   **Solicitação (`/forgot-password`)**:
        -   Input de e-mail.
        -   "Captcha" simples (matemático ou honeypot) para evitar bots básicos.
        -   Ao enviar: chama função (simulada ou Edge Function) que geraria o token e enviaria o e-mail. *Como não temos Edge Functions ativas no ambiente local, usaremos a API nativa do Supabase `resetPasswordForEmail` que já lida com tokens magic link, ou implementaremos a lógica manual se o usuário insistir na tabela customizada.*
        -   **Decisão Estratégica**: O Supabase já possui `resetPasswordForEmail` que envia um link com token (PKCE). A tabela customizada solicitada (`auth.password_reset_tokens`) sugere um fluxo manual onde geramos um token curto ou específico. Vou implementar a tabela para *logs e controle*, mas usar a API nativa para o reset efetivo, ou simular o envio se for puramente "self-hosted" sem serviço de auth configurado.
        -   *Ajuste*: O usuário pediu explicitamente a tabela. Farei o fluxo híbrido: Gero o registro na tabela para auditoria/controle de limite, e uso `supabase.auth.resetPasswordForEmail` com redirecionamento para nossa página de reset.

    -   **Redefinição (`/reset-password`)**:
        -   Captura o `access_token` ou `code` da URL (padrão Supabase PKCE).
        -   Valida sessão.
        -   Formulário de nova senha + confirmação.
        -   Medidor de força de senha.

4.  **Roteamento**
    -   Adicionar rotas `/forgot-password` e `/reset-password` no `router.tsx`.
    -   Adicionar link "Esqueci minha senha" na página de Login.

5.  **Segurança**
    -   A tabela `password_reset_tokens` servirá para Rate Limiting (contar solicitações recentes por IP ou Email).

## Arquivos a Criar/Modificar
-   `db/600_password_reset.sql` (Nova migration)
-   `pages/ForgotPassword.tsx` (Nova página)
-   `pages/ResetPassword.tsx` (Nova página)
-   `router.tsx` (Novas rotas)
-   `pages/Login.tsx` (Link para forgot-password)
-   `.env` (Template de SMTP)

## Aviso Importante
Como estou num ambiente WebContainer/Local, não consigo configurar o serviço SMTP real do Supabase Self-Hosting (que fica no `config.toml` ou variáveis de ambiente do Docker). Fornecerei o código e as instruções exatas de onde colocar essas configurações.