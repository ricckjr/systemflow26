---
name: "planning-with-files"
description: "Planeja mudanças complexas com múltiplos arquivos. Invocar em mudanças estruturais, features grandes, refactors ou alterações frontend+backend."
---

# Planning with Files — SystemFlow

Objetivo
- Planejar mudanças complexas antes de editar múltiplos arquivos, garantindo alinhamento com .trae/project_rules.md, .claude/napkin.md e o design system em .interface-design/.

Quando usar
- Mudanças estruturais
- Novas features grandes
- Refactors de impacto
- Alterações que envolvam frontend + backend

Instruções
- Antes de editar qualquer arquivo:
  1) Analisar a estrutura atual do projeto (frontend/, backend/, db/, docs/, workflows/).
  2) Identificar arquivos afetados (com caminhos absolutos).
  3) Dividir o trabalho em fases/coortes coesas.
  4) Identificar riscos técnicos e de produto.
  5) Criar checklist de validação.
- Respeitar as Regras do Projeto em .trae/project_rules.md (tokens de design, lucide-react, React Query sem duplicar estado, RequirePermission/useAuthContext, Supabase/Docker/RBAC).
- Nunca alterar lógica de negócio durante esta etapa de planejamento.

Formato de resposta
- Objetivo
- Estrutura Atual
- Arquivos Afetados
- Riscos
- Plano de Implementação
- Checklist de Validação

Notas
- Produzir a resposta em Português Brasileiro.
- Garantir que recomendações respeitem o design system e a arquitetura atual do SystemFlow.

