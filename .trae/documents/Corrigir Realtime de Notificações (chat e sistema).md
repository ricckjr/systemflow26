## Diagnóstico (sem achismo)
1. Adicionar um modo de diagnóstico visível no app (ativado por `?rtdebug=1`) exibindo:
   - Status do socket Realtime (open/close) e último erro
   - Status dos channels de chat e sistema (SUBSCRIBED/TIMED_OUT/CHANNEL_ERROR)
   - Quantidade de channels ativos no client (`supabase.getChannels()`), para detectar duplicação/limite
   - Contadores de eventos recebidos por tabela e por filtro
2. Criar um “teste de evento” no frontend (somente quando `?rtdebug=1`) que:
   - Insere uma notificação de teste para o usuário logado
   - Valida se o evento chega via `postgres_changes` em até X segundos
   - Exibe o resultado (chegou/não chegou) na UI

## Correções prováveis no frontend
1. Normalizar cleanup de channels:
   - Trocar `channel.unsubscribe()` por `supabase.removeChannel(channel)` onde aplicável
   - Garantir que nunca existam múltiplos channels com o mesmo propósito ao trocar de rota/usuário
2. Centralizar o “realtime auth + reconnect”:
   - Criar um pequeno gerenciador que escuta `socket` open/close
   - Reaplica `realtime.setAuth(access_token)` em mudanças de sessão
   - Força resubscribe dos channels críticos quando o socket reconecta
3. Remover concorrência de subscriptions duplicadas:
   - O `Header` hoje tem subscriptions próprias para dropdown (chat) usando `profile.id`
   - Padronizar para usar o mesmo `userId` da sessão e preferir dados vindos dos contexts (1 fonte da verdade)

## Sons (chat e sistema)
1. Logar (em `?rtdebug=1`) toda tentativa de `play*Sound()` e capturar erro de autoplay (Promise rejeitada)
2. Se o evento realtime estiver chegando mas o som não tocar:
   - Garantir que `primeNotificationAudio()` foi executado após interação
   - Fazer fallback para WebAudio quando `Audio.play()` falhar

## Validação
1. Testar no ambiente real (o mesmo domínio do usuário) com `?rtdebug=1`:
   - Gerar notificação de teste e confirmar que o contador de eventos sobe sem reload
   - Confirmar que badges atualizam imediatamente
   - Confirmar que o som toca no momento do evento
2. Rodar build e checar que não há regressões de tipos/TS.

## Entregáveis
- Correção definitiva do fluxo realtime sem reload
- Diagnóstico `?rtdebug=1` para monitorar conexão em produção
- Unificação das fontes de dados (contexts) e eliminação de subscriptions duplicadas
- Ajuste do disparo de som com logs e fallback quando bloqueado