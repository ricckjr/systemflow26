## 1) Análise do que existe hoje
- **Badge global (Header)**: já existe `unreadChatCount` e subscription em `chat_notifications`, mas hoje ele está como **contador** e o dropdown de mensagens **não atualiza em tempo real** (ele só faz fetch quando abre). Veja [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx).
- **Lista de conversas (ChatInterno)**: a UI já tem **bolinha + texto em negrito** (`info.hasUnread`), porém:
  - `hasUnread` está **implementado só para direct** e **fixo como false para grupos** ([ChatInterno.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunicacao/ChatInterno.tsx#L372-L412)).
  - O cálculo depende de `members.last_read_at` vindo do `getRooms()`, mas o `useChat` **marca como lida no banco** e **não atualiza o `last_read_at` local da lista**, então a bolinha pode não sumir corretamente.
  - O `useChat` só assina realtime da **sala ativa**; se chega mensagem em outra sala, a lista de rooms não é atualizada sem reload. Veja [useChat.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/hooks/useChat.ts#L43-L162).
- **Fonte correta de “não lidas” já existe no banco**: `chat_notifications` é criada por trigger em `chat_messages` (e é a melhor base para “WhatsApp-like unread”).

## 2) Estado (definição clara)
Vou padronizar o estado de “não lidas” em um único lugar (global), baseado em `chat_notifications`:
- `unreadByRoomId: Record<string, number>`: contador por conversa (permite bolinha por conversa e evoluir para número depois).
- `totalUnread: number` (derivado de `unreadByRoomId`).
- `hasAnyUnread: boolean` (`totalUnread > 0`) para o badge global.
- Ações:
  - `markRoomAsRead(roomId)` (zera o contador local imediatamente e faz update no Supabase para `is_read=true`).
  - `handleIncomingNotification(roomId, notifId, messageId)` (incremental, sem refetch geral).

## 3) Implementação (código limpo, tipado, incremental)
### 3.1 Criar Store/Context global (sem loops / sem refetch geral)
- Criar um `ChatNotificationsProvider` (Context + hook) que:
  - Faz **carga inicial** de não lidas: `select room_id from chat_notifications where user_id=... and is_read=false` e agrega em JS.
  - Cria subscription realtime em `chat_notifications` (somente do usuário logado):
    - `INSERT`: incrementa `unreadByRoomId[room_id]`.
    - `UPDATE`: decrementa (quando `is_read` virar true) e remove chave quando zerar.
  - Mantém tudo incremental (sem `refetch` geral em cada evento).

### 3.2 Badge global (Header + Sidebar)
- **Header**: trocar o comportamento para “WhatsApp”:
  - Se `hasAnyUnread` → mostrar **bolinha** (sem número).
  - Se `!hasAnyUnread` → esconder.
  - O dropdown de mensagens passa a receber eventos e pode **prepend** na lista (visual imediato) sem precisar reabrir.
- **Sidebar**:
  - Mostrar bolinha no item “Chat Interno” e/ou no módulo “COMUNICAÇÃO” quando houver não lidas.

### 3.3 Lista de conversas dentro do Chat
- Alterar a lógica do `hasUnread` do `getRoomInfo` para usar o store:
  - `hasUnread = (unreadByRoomId[room.id] ?? 0) > 0` para **direct e group**.
  - Texto da última mensagem fica **negrito** se `hasUnread`.
  - Bolinha pequena ao lado conforme regra.
- Ao clicar numa conversa (`handleRoomSelect`):
  - Chamar `markRoomAsRead(roomId)` **antes**/junto de `setActiveRoomId` para o dot sumir instantaneamente.

### 3.4 Regras de tempo real (ativo vs não ativo)
- No provider, manter `activeRoomId` (passado pelo ChatInterno) ou expor `setActiveRoom(roomId)`.
- Quando chegar `INSERT` em `chat_notifications`:
  - Se `room_id === activeRoomId` e a página do chat está aberta → marcar como lida automaticamente (somente essa conversa).
  - Se for outra conversa → só incrementa e mostra badge.

## 4) Ajustes técnicos pontuais (performance)
- Evitar re-renderizações globais:
  - Context com estado mínimo (map/contadores) e `useMemo` no value.
  - Atualização por chave (room) e total derivado.
- Evitar loops:
  - `markRoomAsRead` ajusta estado local e o handler de `UPDATE` só “confirma” (clamp para nunca ficar negativo).

## 5) Arquivos que serão alterados/criados
- Criar: `frontend/src/contexts/ChatNotificationsContext.tsx` (store)
- Alterar: [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx) (badge-dot + live list)
- Alterar: [Sidebar.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Sidebar.tsx) (bolinha)
- Alterar: [ChatInterno.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunicacao/ChatInterno.tsx) (hasUnread baseado no store + markRoomAsRead)
- Alterar: layout raiz (ex.: [MainLayout.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/MainLayout.tsx)) para envolver a app com o provider.

## 6) Validação
- Receber mensagem em outra conversa:
  - aparece bolinha no Header/Sidebar sem reload.
  - conversa correta fica com bolinha e última mensagem em negrito.
- Abrir a conversa:
  - bolinha da conversa some na hora.
  - badge global some quando zerar.
- Receber mensagem na conversa ativa:
  - não cria badge (ou some imediatamente) e marca lida automaticamente.

Se você confirmar este plano, eu implemento tudo (provider + badges + regras realtime) seguindo exatamente essas regras de UX estilo WhatsApp.