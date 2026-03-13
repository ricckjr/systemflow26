# SystemFlow — Interface Design System

## Direction & Feel

**Product:** Enterprise business operations platform (CRM, Produção, Financeiro, RH, Logística)
**User:** Business operators — managers reviewing pipelines, salespeople between calls, admins controlling the company
**Primary action:** Scan, assess, act. Dense data that communicates status at a glance.
**Feel:** Cold precision. Like a trading terminal crossed with a clean ops dashboard. Dense but not noisy. Dark by default.

---

## Color Palette

All colors come from CSS custom properties in `frontend/src/styles/theme.css`. Never use raw hex values in components — always use tokens.

### Surfaces (elevation scale)

```css
--bg-main:  #0B0F14   /* canvas — deepest layer */
--bg-panel: #0F172A   /* panels, sidebars, modals */
--bg-card:  #111827   /* cards, raised surfaces */
```

**Rule:** Surfaces stack upward — `bg-main` < `bg-panel` < `bg-card`. Dropdowns/tooltips sit one level above their parent surface. Inputs use `bg-panel` (inset feel). **Do NOT use `--bg-body`** — that token does not exist. Use `--bg-main` instead.

### Typography hierarchy

```css
--text-main: #E5E7EB   /* primary — body, labels, values */
--text-soft: #9CA3AF   /* secondary — supporting labels, subtext */
--text-muted: #6B7280  /* tertiary — metadata, placeholders, disabled */
```

### Brand

```css
--primary:      #38BDF8   /* sky-400 — CTAs, focus rings, accents */
--primary-600:  #0284C7   /* hover state for primary */
--primary-700:  #0369A1   /* pressed state */
--primary-soft: rgba(56,189,248,0.14)  /* glow halos, focus ring fill */
```

**Button text on `--primary` background:** use `#041018` (dark, high-contrast). On hover (`--primary-600`), switch to `#ffffff`.

### Semantic

```css
--success: #10B981   /* emerald-500 */
--warning: #F59E0B   /* amber-500 */
--danger:  #EF4444   /* red-500 */
```

### Borders

```css
--border: rgba(255,255,255,0.05)   /* standard separation */
--line: var(--border)              /* alias */
```

Hover/emphasis borders: `border-[var(--primary)]/25` or `/30`. Never solid hex borders.

---

## Depth Strategy: **Borders-only + minimal shadows**

- Layout separation: `border border-[var(--border)]` only — no shadows
- Cards: `box-shadow: none` — border only (`.card`, `.card-panel`)
- Dropdowns / modals: `--shadow-soft: 0 8px 24px rgba(0,0,0,0.35)`
- **No `backdrop-blur` on cards** — only on fixed overlays (TV mode exit button, dropdowns)
- Glow decorations (KPI cards): absolute positioned `blur-3xl` div, `opacity-10` — purely decorative

---

## Spacing

Base unit: **4px (Tailwind default)**. Scale in use:
- Micro: `gap-1`, `gap-2` (icon gaps, badge padding)
- Component: `p-3`, `p-4`, `p-5` (cards, buttons)
- Section: `gap-5`, `space-y-6`
- Page: `gap-6`

**Prefer `gap-5` over `gap-6`** for card grids — slightly tighter fits the dense enterprise feel.

---

## Typography

Font: `Inter` (system-ui fallback chain)

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Page title | `text-2xl` | `font-bold` | `tracking-tight` |
| Section header | `text-sm` | `font-semibold` | `uppercase tracking-wider` |
| Card label | `text-xs` | `font-semibold` | `uppercase tracking-widest` |
| KPI value (main) | `text-3xl` | `font-bold` | `tracking-tight` |
| KPI value | `text-2xl` | `font-bold` | `tracking-tight` |
| Body / table cell | `text-sm` | normal / `font-medium` | |
| Metadata / badge | `text-xs` | `font-medium` or `font-bold` | |
| Table header | `text-xs` | `font-semibold` | `uppercase` |

**Do NOT use `text-[11px]`** — use `text-xs` instead. Tailwind arbitrary sizes create inconsistency.

---

## Border Radius

```css
--radius-card:  14px  → rounded-2xl (cards, modals)
--radius-input: 12px  → rounded-xl (inputs, buttons)
--radius-pill:  999px → rounded-full (pills, badges, progress bars)
```

Small interactive (badges, status chips): `rounded-lg` or `rounded-full`.

---

## Component Patterns

### KPI Card

```tsx
<div className="relative overflow-hidden rounded-2xl p-5 border bg-[var(--bg-panel)] border-[var(--border)] hover:border-[var(--primary)]/25 transition-colors duration-200">
  {/* Icon + trend badge row */}
  <div className="flex justify-between items-start mb-4">
    <div className="p-3 rounded-xl bg-{color}-500/10 text-{color}-400 border border-{color}-500/20">
      <Icon size={24} />
    </div>
    <div className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--bg-main)] text-emerald-400|rose-400">
      ↑ 12.3%
    </div>
  </div>
  {/* Label + value */}
  <p className="text-xs uppercase tracking-widest font-semibold text-[var(--text-soft)] mb-1">Label</p>
  <h3 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Value</h3>
  {/* Decorative glow — always present, always subtle */}
  <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-3xl opacity-10 bg-{color}-500/30 pointer-events-none" />
</div>
```

**Main KPI** (e.g. Vendas): `border-amber-500/25` instead of `--border`. No extra shadow.

### Buttons

```tsx
/* Primary */
<button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[#041018] hover:bg-[var(--primary-600)] hover:text-white active:scale-95 transition-all duration-300 font-medium text-sm">

/* Ghost / secondary */
<button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all duration-300 font-medium text-sm">
```

### Inputs

```tsx
<input className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all" />
```

Or use `.input-primary` global class from theme.css.

### Cards / Panels

Use global classes `.card` or `.card-panel` for consistent surface + border + radius. Override padding as needed.

### Tables

- Header row: `sticky top-0 bg-[var(--bg-panel)] z-10 border-b border-[var(--border)]`
- Header cells: `text-xs uppercase font-semibold text-[var(--text-muted)]` + sortable cursor
- Data rows: `border-b border-[var(--border)] hover:bg-[var(--bg-main)] transition-colors`
- Alternating rows: odd `bg-[var(--bg-main)]/60`

### Progress Bar

```tsx
<div className="h-4 w-full bg-[var(--bg-main)] rounded-full overflow-hidden border border-[var(--border)] p-[2px]">
  <div className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-emerald-400 transition-all duration-1000 ease-out" style={{width: `${percent}%`}} />
</div>
```

### Badges / Status chips

```tsx
<span className="text-xs font-bold px-2 py-0.5 rounded-lg border bg-emerald-400/10 text-emerald-400 border-emerald-400/30">
  Active
</span>
```

---

## Grid Layout

Standard dashboard grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5`

Charts section: `grid grid-cols-1 xl:grid-cols-12 gap-5` — main chart takes `xl:col-span-7`, secondary `xl:col-span-5`.

---

## Common Mistakes to Avoid

| Wrong | Right |
|-------|-------|
| `bg-[var(--bg-body)]` | `bg-[var(--bg-main)]` — `--bg-body` does not exist |
| `text-[11px]` | `text-xs` |
| `shadow-lg shadow-amber-900/10` on cards | No shadow on cards — border only |
| `backdrop-blur-md` on static cards | Only on fixed/floating overlays |
| `gap-6` in card grids | `gap-5` |
| Raw hex in className | Always use CSS token `var(--...)` |
| `border-indigo-500/50` on hover | `border-[var(--primary)]/30` — stay on-token |
| Wrapping `MetaProgressBar` in extra `<div className="mb-6">` | Let parent `space-y-*` handle vertical spacing |
