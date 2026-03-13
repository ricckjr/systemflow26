---
name: "pr-review"
description: "Revisa mudanças de código como revisor sênior. Invocar para mudanças grandes, validação pré-merge e refactors."
---

# PR Review — SystemFlow

Objetivo
- Revisar mudanças de código com foco em regressões, bugs, naming, arquitetura, contratos e edge cases.

Quando usar
- Revisar mudanças grandes
- Validar implementação antes de merge
- Revisar refactors

Instruções
- Ler diffs com atenção a contratos (tipos, APIs, schemas) e impactos.
- Verificar regressões, fluxos alternativos e erros silenciosos.
- Checar naming, boundary entre camadas e aderência à arquitetura do SystemFlow.
- Confirmar uso correto de React Query (sem duplicar estado) e tokens do design system.
- Garantir que permissões usam RequirePermission/useAuthContext e que acesso a dados respeita Supabase/RLS.
- Não alterar lógica de negócio ao apontar problemas; sugerir correções e testes.
- Seguir .trae/project_rules.md, .claude/napkin.md e .interface-design/system.md.

Formato de resposta
- Resumo da Mudança
- Problemas Críticos
- Problemas Importantes
- Observações
- Riscos de Regressão
- Próximos Passos

Notas
- Responder em Português Brasileiro.
- Incluir sugestões objetivas e acionáveis, com foco em segurança e qualidade.

