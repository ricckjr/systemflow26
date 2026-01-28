## Estado Atual (o que já existe)

* Notificações “de sistema” e “de chat” já são separadas por tabela e contexto:

  * Sistema: `public.notifications` + [SystemNotificationsContext.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/contexts/SystemNotificationsContext.tsx)

  * Chat: `public.chat_notifications` + [ChatNotificationsContext.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/contexts/ChatNotificationsContext.tsx)

  * Badges separados no header: sininho e chat em [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx)

* Som existe, mas é 1 só (genérico) para ambos: [notificationSound.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/utils/notificationSound.ts)

* Web Push / Service Worker / `Notification.requestPermission()` ainda não existem no projeto (nenhum uso encontrado).

* O “dashboard/home” atual pós-login é `/app/comunidade` (InstaFlow): [routes/index.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/routes/index.tsx#L57-L66) e [InstaFlow.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunidade/InstaFlow.tsx)

## Objetivo

* Adicionar um **banner discreto** assim que logar no sistema pedindo permissão de notificações (soft prompt), respeitando:

  * Não pedir permissão ao carregar.

  * Pedir apenas ao clicar “Habilitar”.

  * “Depois” some e aplica cooldown (7 dias).

* Separar preferências por tipo (Sistema vs Mensagens):

  * Flags independentes.

  * Badges continuam separados.

  * Push/nativo preparado para evolução.

* Implementar **sons diferentes** (sistema vs chat) e preferências independentes.

## Implementação (Frontend)

### 1) Banner Soft Prompt assim que logar no sistema

* Criar um componente de banner (ex.: `NotificationPermissionBanner`) com:

  * Texto fixo: “Habilite nossas notificações para receber alertas, mensagens e atualizações importantes.”

  * Botões: “Habilitar” e “Depois”.

  * Estilo alinhado aos padrões já usados (border/blur/cantos arredondados, SaaS dark): referências úteis em [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx#L303-L310) e toasts em [TaskFlow.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunidade/TaskFlow.tsx#L1170-L1185)

* Mostrar o banner somente quando:

  * `Notification` existir no browser.

  * `Notification.permission === 'default'`.

  * Não estiver em cooldown.

* Inserir o banner no topo do “dashboard” atual (InstaFlow), sem afetar outras telas: ponto sugerido em [InstaFlow.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunidade/InstaFlow.tsx#L450-L477)

* Persistência do cooldown:

  * Implementar chave de storage (local) com `dismissed_until`.

  * Se o usuário clicar “Depois”, definir `now + 7 dias` e ocultar.

### 2) Pedido Nativo de Permissão (somente por clique)

* No clique em “Habilitar”:

  * Chamar `Notification.requestPermission()`.

  * Tratar retorno `granted/denied/default`.

  * Esconder o banner quando `!== 'default'`.

* Preparar uma util/serviço (ex.: `notificationPermission.ts`) com:

  * `canUseNotifications()`

  * `getPermission()`

  * `requestPermissionOnUserGesture()`

  * `shouldShowSoftPrompt()` (considera cooldown + permission)

### 3) Preferências Separadas por Tipo (Sistema vs Mensagens)

* Criar um provider/hook de preferências (ex.: `NotificationPreferencesContext`) que expõe:

  * `system`: `inAppEnabled`, `soundEnabled`, `nativeEnabled` (para notificações do navegador), `pushEnabled` (futuro)

  * `chat`: mesmos campos

* Alterar contexts atuais para respeitar preferências:

  * [SystemNotificationsContext.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/contexts/SystemNotificationsContext.tsx):

    * Não tocar som se `system.soundEnabled=false`.

    * (Opcional) Se `system.inAppEnabled=false`, não computar `unreadCount` no badge (ou zera no header).

  * [ChatNotificationsContext.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/contexts/ChatNotificationsContext.tsx):

    * Som só se `chat.soundEnabled=true`.

    * Badge só se `chat.inAppEnabled=true`.

* Notificações “nativas” (do navegador) enquanto o app está aberto:

  * Ao chegar evento realtime, se `nativeEnabled=true` e permissão for `granted`, disparar `new Notification(...)`:

    * Sistema: título/conteúdo de `notifications`.

    * Chat: “Nova mensagem” + nome do remetente (quando disponível) e room.

  * Manter comportamento atual de não notificar a sala ativa no chat.

### 4) Sons Diferentes (Sistema vs Chat)

* Refatorar [notificationSound.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/utils/notificationSound.ts) para suportar 2 sons:

  * `playSystemAlertSound()` (timbre/padrão curto tipo “alerta operacional”).

  * `playChatMessageSound()` (timbre/padrão mais “mensagem”).

* Separar preferências (storage keys) para som:

  * Ex.: `systemflow:sound:system:enabled` e `systemflow:sound:chat:enabled`.

* Atualizar os callsites:

  * Sistema: [SystemNotificationsContext.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/contexts/SystemNotificationsContext.tsx)

  * Chat: [ChatNotificationsContext.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/contexts/ChatNotificationsContext.tsx)

* Ajustar UI atual do chat (que hoje alterna som global) em [ChatInterno.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunicacao/ChatInterno.tsx#L1529-L1540) para alternar apenas o som de chat.

* Adicionar um toggle equivalente para o som do sistema (seção no Perfil ou no dropdown do sininho).

## Implementação (Backend/DB – Supabase)

### 5) Tabela de Preferências por Usuário

* Criar migration SQL (no padrão `backend/src/db/migrations`) para:

  * `public.notification_preferences` (PK `user_id`):

    * `system_in_app_enabled`, `system_sound_enabled`, `system_native_enabled`, `system_push_enabled`

    * `chat_in_app_enabled`, `chat_sound_enabled`, `chat_native_enabled`, `chat_push_enabled`

    * `permission_prompt_dismissed_until` (timestamptz)

    * `created_at`, `updated_at`

  * RLS: usuário só lê/atualiza sua própria linha.

  * Policy INSERT/UPDATE/SELECT adequada para `auth.uid()`.

* Frontend passa a ler/escrever essa tabela (com fallback local se necessário).

### 6) Preparação para Push Distinto (sem implementar envio agora)

* Deixar o modelo pronto para próxima fase:

  * Tabela futura `push_subscriptions` (ex.: `user_id`, `platform`, `subscription jsonb`, `system_enabled`, `chat_enabled`).

  * Isso permite push separado por canal e expansão mobile.

## Validação

* Verificar:

  * Banner aparece apenas em `/app/comunidade` quando `permission=default` e sem cooldown.

  * Clique em “Habilitar” abre prompt nativo; sem chamada automática no load.

  * “Depois” some e não retorna por 7 dias.

  * Sons: sistema e chat tocam padrões diferentes e respeitam toggles.

  * Badges sininho/chat continuam independentes no header.

## Observações Importantes (decisão técnica)

* A permissão do browser (`Notification.permission`) é global por site; as “preferências por tipo” serão internas do app (flags por canal) e controlam som/badge/notificação nativa/push futuro.

