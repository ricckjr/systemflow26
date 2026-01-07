# Comercial – Unificação e Utilitários

## Cockpit Comercial
- Página canônica: `pages/comercial/VisaoGeral.tsx`
- Componentes reutilizáveis:
  - `components/comercial/TrendCard.tsx`
  - `components/comercial/InfoBox.tsx`
- Rotas:
  - `/comercial/overview` → Visão Geral
  - `/comercial/performance` → Performance
  - `/comercial/oportunidades` → Oportunidades

## Utilitários de Valor/Moeda
- Fonte única: `utils/comercial/format.ts`
  - `parseValorProposta(string | null) => number`
  - `formatCurrency(number) => string`
- Uso:
  - Importar utilitários onde houver valores de proposta para evitar duplicações e inconsistências.
  - Substituir funções locais anteriores (`parseValue`, `parseValor`) pelos utilitários.

## Boas Práticas
- Evitar repetir lógica de parsing/formatting.
- Manter KPIs e cálculos dentro de `useMemo`.
- Tratar `null`/strings vazias como `0` em cálculos de valor.
