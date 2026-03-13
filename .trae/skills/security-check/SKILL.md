---
name: "security-check"
description: "Revisa segurança de backend e frontend. Invocar ao revisar APIs, middlewares, permissões e acesso a dados."
---

# Security Check — SystemFlow

Objetivo
- Revisar segurança de backend e frontend com foco em autenticação, autorização, validação de entrada, proteção de secrets, CORS, variáveis de ambiente, uso do Supabase e RLS.

Quando usar
- Revisar APIs e handlers
- Revisar middlewares
- Revisar permissões e RBAC
- Revisar acesso a dados (RLS/Supabase)

Instruções
- Verificar autenticação (fluxos de login, renovação, revogação) e autorização (RequirePermission/useAuthContext no FE, RBAC/guards no BE).
- Checar validação de entrada, sanitização e tratamento de erros.
- Confirmar que secrets e env vars não estão hardcoded; usar .env e configs seguras.
- Revisar CORS, cookies/sameSite/secure e cabeçalhos de segurança quando aplicável.
- Garantir conformidade com RLS do Supabase e uso correto de policies.
- Não expor dados sensíveis em logs ou UI; seguir .trae/project_rules.md e .claude/napkin.md.

Formato de resposta
- Resumo de Segurança
- Riscos Críticos
- Riscos Importantes
- Melhorias Recomendadas
- Validação

Notas
- Responder em Português Brasileiro.
- Fornecer recomendações acionáveis, com priorização por risco.

