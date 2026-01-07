# SystemFlow — Design System (Dark Minimal)

## Paleta de Cores
- Primárias: `--bg-main #0b1e2d` (fundo), `--bg-glass rgba(15,37,56,0.78)` (superfície), `--blue-neon #2a6ecb` / `--blue-strong #2260a9` (ações)
- Texto: `--text-main #ffffff`, `--text-soft #cbd5e1`, `--text-muted #8fa3b8`
- Borda: `--line rgba(255,255,255,0.08)`

## Tipografia
- Fonte: Inter (400–800)
- Títulos: peso 800, cor `--text-main`
- Texto: peso 600–700, cor `--text-soft`

## Superfícies
- Cards e painéis: glass (`--bg-glass`), `backdrop-filter: blur(20–24px)`, `border: 1px solid --line`, sombras neon sutis

## Componentes
- Inputs: fundo `rgba(15,37,56,0.85)`, borda branca sutil, foco com `--blue-neon` + `--glow`
- Botões primários: `linear-gradient(#2a6ecb, #2260a9)`, raio pill, glow
- Navegação: fundo `--bg-main`, itens com foco/hover acessível, contraste alto

## Acessibilidade
- Estados de foco visíveis (`focus:ring` com `brand`)
- Contrast ratio mínimo AA para texto principal

## Responsividade
- Mobile-first; sidebar colapsa; tipografia fluida com utilitários

## Diretrizes
- No máximo 3 cores principais (fundo, superfície, ação)
- Evitar ruídos visuais; privilegiar legibilidade e espaçamento uniforme

## Implementação
- Tokens em `style.css`
- Tailwind mapeado em `tailwind.config.ts` (navy/brand/ink/line)
- Navegação em `components/Layout.tsx` com foco/aria e estados mínimos
