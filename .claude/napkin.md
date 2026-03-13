# Napkin Runbook — SystemFlow26

Primeiramente, em todas as sessões, leia .claude/napkin.mdantes de qualquer outra coisa. Internalize o conteúdo e aplique-o silenciosamente. Não anuncie que leu. Simplesmente aplique o que aprendeu.

Sempre que você ler, faça as alterações necessárias imediatamente:

Reordene os itens por importância (do mais importante para o mais difícil).
Mesclar duplicados e remover notas obsoletas/com pouco sinal.
Mantenha apenas orientações recorrentes e de alta frequência.
Certifique-se de que cada item contenha uma ação explícita do tipo "Fazer em vez de".
Impor limites por categoria (10 melhores por categoria).
Se ainda não existe um guardanapo, crie um em .claude/napkin.md

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

---

## Execution & Validation (Highest Priority)

1. **[2026-03-13] `--bg-body` não existe no theme.css**
   Do instead: usar `bg-[var(--bg-main)]` — é o token correto para o fundo do canvas. `--bg-body` é um token fantasma que não existe em `frontend/src/styles/theme.css`.

2. **[2026-03-13] Não usar `text-[11px]` em classes Tailwind**
   Do instead: usar `text-xs` (12px). Tamanhos arbitrários criam inconsistência com a escala tipográfica definida no design system.

3. **[2026-03-13] Cards não têm shadow — apenas border**
   Do instead: usar só `border border-[var(--border)]` em cards/panels. As classes `.card` e `.card-panel` já definem `box-shadow: none`. Não adicionar `shadow-lg`, `shadow-xl` etc.

4. **[2026-03-13] `backdrop-blur` apenas em overlays flutuantes**
   Do instead: não usar `backdrop-blur-md` em cards estáticos. Reservar para elementos fixed/absolute que flutuam sobre o conteúdo (ex: botão "Sair da Tela Cheia" no modo TV).

5. **[2026-03-13] Não envolver componentes em `<div>` de espaçamento extra**
   Do instead: deixar o `space-y-*` ou `gap-*` do container pai gerenciar o espaçamento vertical. Ex: `MetaProgressBar` não precisa de `<div className="mb-6">` wrapper.

---

## Design System & Tokens

1. **[2026-03-13] Tokens de cor disponíveis em `theme.css`**
   Do instead: sempre usar `var(--)`. Tokens válidos: `--bg-main`, `--bg-panel`, `--bg-card`, `--text-main`, `--text-soft`, `--text-muted`, `--primary`, `--primary-600`, `--primary-700`, `--primary-soft`, `--success`, `--warning`, `--danger`, `--border`, `--line`.

2. **[2026-03-13] Hover em borders: usar token primary, não hardcoded**
   Do instead: `hover:border-[var(--primary)]/30` em vez de `hover:border-indigo-500/50`. Mantém consistência com o accent color do sistema.

3. **[2026-03-13] Botão primário: texto escuro no fundo `--primary`**
   Do instead: `text-[#041018]` no estado normal (azul claro `#38BDF8` precisa de contraste escuro). No hover (`--primary-600`), usar `text-white`.

4. **[2026-03-13] Gap de cards: `gap-5`, não `gap-6`**
   Do instead: `gap-5` em grids de cards para densidade enterprise. `gap-6` deixa o layout frouxo demais para a identidade do produto.

---

## Stack & Arquitetura

1. **[2026-03-13] Frontend usa React Query com staleTime 5min**
   Do instead: não criar estado local para dados do servidor. Usar hooks de `services/` + `hooks/` existentes. Invalidação via `useInvalidateCRM()` e similares.

2. **[2026-03-13] Types do DB são auto-gerados — não editar**
   Do instead: editar `types/domain.ts` para tipos de negócio. Nunca editar `types/database.types.ts` manualmente.

3. **[2026-03-13] Permissões: usar `RequirePermission` ou `useAuthContext`**
   Do instead: não fazer verificações de cargo ad-hoc. Padrão: `RequirePermission` no roteamento, `useAuthContext` para renderização condicional.

4. **[2026-03-13] Icons: apenas Lucide React**
   Do instead: não importar de `react-icons`, `heroicons`, ou outra lib. Importar sempre de `lucide-react`.

---

## Interface Design — Progresso

1. **[2026-03-13] Redesign de layout concluído: Sidebar + Header + MainLayout**
   Status: Sidebar, Header e MainLayout reescritos. Sidebar usa tokens `--border`, `--primary`, `--text-muted`. Header: h-14, breadcrumb dois níveis, ícones de status discretos. MainLayout: removido wrapper `rounded-2xl bg-card` desnecessário.

2. **[2026-03-13] Dashboard Comercial (VisaoGeral) redesenhado**
   Status: KPIs agrupados por seção (Ligações / Comercial / Pipeline), cards menores e mais elegantes, MetaProgressBar com gradiente dinâmico por status, botões menores e mais discretos.

3. **[2026-03-13] Token audit global aplicado**
   Status: Todos os arquivos `.tsx` do projeto foram varridos e corrigidos — `--bg-body` → `--bg-main`, `text-[11px]` → `text-xs`, `shadow-sm` removido de cards, hex hardcoded → tokens CSS. Zero occurrências restantes.

4. **[2026-03-13] Redesign global de tokens concluído — zero violações críticas**
   Status: Todos os 67+ arquivos `.tsx` auditados. Zero ocorrências de: `text-[10px]`, `text-[11px]`, `border-white/*`, `bg-white/5`, `shadow-sm/lg/xl`, `bg-[#hex]` fora do sistema, `cyan-*`, `--bg-body`. OportunidadesKanban cards redesenhados (valor em destaque, badges compactos, linha de cor de status, avatar menor). Estoque, ComprasKanban, Configuracoes, ChatInterno — todos tokenizados.

5. **[2026-03-13] Próximos módulos para redesign visual profundo**
   Ordem: CRM/Vendedores (modal RelatorioVendedorModalContent), Logistica (kanban cards), ConfigGerais, SmartFlow/IAFlow, Universidade/Catalogos.

---

## User Directives

1. **[2026-03-13] Responder sempre em Português Brasileiro**
   Do instead: todas as respostas em pt-BR, incluindo comentários em código novo, mensagens de commit e explicações.
