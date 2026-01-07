# Networking e Disponibilidade do Supabase

## Objetivo
Reduzir erros de rede visíveis em DevTools quando o serviço Supabase estiver indisponível, mantendo a aplicação operante com perfil local e permissões vazias.

## Estratégia
1. Não usar pings HTTP ativos para checar disponibilidade. Preferir `navigator.onLine` e tentar a consulta apenas uma vez.
2. Ao falhar uma consulta (ex.: `rest/v1/profiles`), marcar `supabaseDown = true` e persistir em `localStorage`.
3. Em inicializações subsequentes, se `supabaseDown` estiver marcado, pular as chamadas ao Supabase e usar fallback local.

## Implementação
- Estado e persistência:
  - `App.tsx` mantém `supabaseDown` em `state` e `localStorage`.
  - Em `catch`, define `supabaseDown = true` e continua com perfil local.
- UI:
  - `Layout.tsx` usa eventos `online/offline` para status visual em vez de requisições HTTP.

## Considerações
- Quando o serviço retornar, basta limpar `localStorage.supabaseDown` para reativar chamadas.
- Evitar múltiplas tentativas agressivas durante indisponibilidade para não poluir logs.
