## Visão Atual
- `pages/comercial/Dashboard.tsx`: Visão geral do funil e KPIs; modais de etapa e de detalhes; paleta indigo/emerald e tokens “industrial”. Ex.: header e KPIs em Dashboard.tsx:156–181; funil/origem:230–286; modais:289–386.
- `pages/comercial/VisaoGeral.tsx`: Mesmo conteúdo e comportamento do Dashboard, com pequenas diferenças de estilo/tokens (bordas, sombras, loading). Ex.: header e KPIs em VisaoGeral.tsx:156–181; funil/origem:230–286; modais:289–385.
- `pages/comercial/Opportunities.tsx`: Lista filtrável de oportunidades (busca, filtros, notas via Supabase). Ex.: filtros e tabela em Opportunities.tsx:161–210; modal detalhado:212–281.
- `pages/comercial/Performance.tsx`: Ranking estático de vendedores e KPIs visuais. Ex.: layout principal em Performance.tsx:16–87.

## Problema
- `Dashboard.tsx` e `VisaoGeral.tsx` são duplicados com o mesmo propósito (cockpit comercial). A duplicidade aumenta manutenção, risco de divergência visual e retrabalho em correções/novos recursos.

## Estratégia de Unificação
- Manter apenas uma página de cockpit: usar `VisaoGeral.tsx` como canônica (nome intuitivo em PT-BR).
- Remover `Dashboard.tsx` e redirecionar/ajustar qualquer link/rota/menu que apontava para ele.
- Extrair componentes compartilhados para reuso:
  - `components/comercial/TrendCard.tsx` (usar versão mais refinada de VisaoGeral)
  - `components/comercial/InfoBox.tsx` (usar versão mais refinada de VisaoGeral)
- Centralizar utilitários comuns (parse e formatação):
  - `utils/comercial/format.ts` com `parseValorProposta` e `formatCurrency`
- Garantir consistência de tokens de design e estados de loading.

## Passos de Implementação
1. Criar `components/comercial/TrendCard.tsx` a partir de VisaoGeral.tsx:390–428.
2. Criar `components/comercial/InfoBox.tsx` a partir de VisaoGeral.tsx:430–440.
3. Mover utilitários para `utils/comercial/format.ts` (de `parseValue` e `formatCurrency`).
4. Atualizar `VisaoGeral.tsx` para importar `TrendCard`/`InfoBox` e utilitários.
5. Remover `pages/comercial/Dashboard.tsx`.
6. Atualizar navegação/menus: substituir qualquer item “Dashboard Comercial” por “Visão Geral” apontando para `VisaoGeral`.
7. Testar Supabase (carregamento, KPIs, funil, modais) e revisar responsividade.

## Considerações de Rota/Nome
- Se preferir URL curta, opcionalmente renomear `VisaoGeral.tsx` para `index.tsx` dentro de `pages/comercial/` e ajustar rotas para `/comercial`.

## Validação
- Verificar: loading, KPIs, funil por etapa, origem, abertura de modais, formato monetário, tendências.
- Checar HMR e build sem warnings; revisar estilos consistentes.

Confirma a unificação mantendo apenas `VisaoGeral` como cockpit comercial e removendo `Dashboard`? Posso executar em seguida.