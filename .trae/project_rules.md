# Regras do Projeto — SystemFlow (Trae)

Estas regras orientam o uso de Assistentes/Skills de IA no projeto SystemFlow, mantendo alinhamento com a arquitetura, o design system e as práticas do time.

## Princípios Gerais
- Responder sempre em Português Brasileiro.
- Seguir o design system definido em .interface-design/ (tokens, tipografia, espaçamento, cores, componentes) e as diretrizes do napkin em .claude/napkin.md.
- Não alterar código de negócio quando a solicitação for exclusivamente de estilo/UX (styling-only).
- Não alterar KPI cards, funil de vendas ou activity feed sem pedido explícito.
- Manter consistência com a arquitetura atual do SystemFlow (React 19 + Vite + React Query + Tailwind; Node/Express; Supabase; Docker; RBAC/RLS).

## UI e Design System
- Sempre usar tokens do design system; não utilizar cores hardcoded quando existir token correspondente.
- Para ícones, usar exclusivamente lucide-react.
- Respeitar responsividade, tipografia e spacing padronizados; evite wrappers desnecessários.

## Dados, Permissões e Estados
- Usar RequirePermission ou useAuthContext para checagens de permissão e renderização condicional.
- Não duplicar estado que já é provido pelo React Query (derivar de caches/seletores quando possível).
- Manter consistência com Supabase (schemas, RLS) e RBAC vigente; não burlar políticas de segurança no frontend ou backend.

## Backend, DB e Infra
- Não editar manualmente database.types.ts (gerado pela pipeline/tipagem de schema). Se precisar incluir tipos, utilize as ferramentas/migrations adequadas.
- Respeitar configuração de Docker e processos de desenvolvimento locais (ports, envs e scripts).
- Tratar secrets e variáveis de ambiente somente via .env e mecanismos seguros; nunca expor chaves em código.

## Fluxo de Trabalho com IA
- Skills de revisão (qualidade, PR, segurança) não podem introduzir mudanças de lógica de negócio sem solicitação explícita.
- Para alterações que afetem múltiplos arquivos/áreas, utilizar a skill “planning-with-files” antes de editar.
- As recomendações de qualquer skill devem respeitar estas Regras do Projeto.

