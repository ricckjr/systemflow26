## Objetivo
- Evoluir o chat interno para um padrão WhatsApp/Slack: UX mais profissional, ações rápidas, tempo real, sem reload, sem quebrar o histórico.

## Ajuste imediato: ações (Responder/Editar/Excluir) mais profissionais
- **Trocar o menu atual por um “action bar” flutuante** no topo do balão (não abaixo): ícones compactos (↩ Responder, ✏ Editar, 🗑 Excluir) aparecendo em hover/foco.
- **Menu em portal (fixed)** quando precisar de lista/mais ações, calculando posição pelo `getBoundingClientRect` para abrir **para cima** quando estiver perto do final da tela (evita “de baixo da mensagem”).
- **Mobile**: implementar **long-press** na mensagem abrindo um “action sheet” (Modal existente), igual WhatsApp.
- Manter permissões: esconder/disabled Editar/Excluir quando não permitido.

## Fase 1 — Essencial (seguir ordem)
### 1) Seen / Unread (não lidas vs lidas)
- Manter o contador por sala via `chat_notifications` (já existe) e trocar o indicador atual por **badge numérico** na lista.
- Implementar “marcar como lida” também quando **usuário realmente chega ao final**:
  - Adicionar `IntersectionObserver` no sentinel do final da lista (ou checagem de scroll) para chamar `markAsRead` + update de `chat_notifications.is_read`.
- Adicionar um **divisor “Não lidas”** no histórico:
  - Usar `chat_room_members.last_read_at` (já existe) para achar a primeira mensagem com `created_at > last_read_at`.

### 2) Status “digitando…” (ephemeral, sem banco)
- Criar um canal Realtime por sala com **broadcast** (ex.: `chat_typing_<roomId>`).
- No input:
  - Enviar `typing:true` com throttle (ex.: 300–600ms) e expirar automaticamente (ex.: 2–3s sem eventos).
- UI:
  - Mostrar abaixo do header: “Fulano está digitando…” (em grupo: “Fulano e Sicrano…”).

### 3) Presença online/offline (e away se possível)
- Reaproveitar `PresenceContext` (já existe) e **padronizar a exibição**:
  - Lista + header do chat com status consistente (online/away/busy/offline).

### 4) Notificações inteligentes + som
- Adicionar util de som discreto (com preload) e toggle de mute (localStorage).
- Tocar som apenas quando:
  - chegar `chat_notifications INSERT`
  - `room_id !== activeRoomId`
  - `sender_id !== meu_user_id`
- Reusar o mesmo som para notificações do sistema (onde já existirem eventos de notificação).

## Fase 2 — Produtividade
### 5) Fixar mensagens
- Banco:
  - Criar tabela `chat_pins(room_id, message_id, pinned_by, pinned_at)` + índices + RLS (membro pode ver; pin/unpin por membro ou por admin/owner).
- UI:
  - Barra de “Fixadas” no topo da conversa; clique rola até a mensagem.
  - Ação de Pin/Unpin no action bar/menu.

### 6) Busca dentro do chat
- Começar com busca **client-side** nos itens carregados (rápido e sem depender de backend).
- UI:
  - Campo de busca dentro da conversa, contador de matches, botões Próximo/Anterior, highlight.
- (Opcional evolutivo) Busca server-side com paginação se o volume crescer.

### 7) Reações às mensagens
- Banco:
  - Tabela `chat_message_reactions(message_id, user_id, emoji, created_at)` + unique + RLS.
- Realtime:
  - Subscriptions em INSERT/DELETE para atualizar estado sem reload.
- UI:
  - Reações agregadas sob o balão + tooltip simples “quem reagiu”.
  - Picker usando o `emoji-picker-react` já existente.

## Fase 3 — Performance e polimento
### 8) Preview rico de anexos
- Melhorar cards de anexos (principalmente PDF/documentos) para não parecer “link cru”.
- (Opcional) Link preview via endpoint/proxy com cache se fizer sentido depois.

### 9) Scroll inteligente + histórico sob demanda
- Auto-scroll **somente se** o usuário estiver no final (threshold), senão:
  - mostrar botão “Novas mensagens (N) ↓”.
- Paginação para histórico antigo:
  - Buscar “antes de” um cursor (`created_at`) ao chegar no topo e **preservar posição de scroll**.

### 10) Cache local
- Implementar cache em memória por `roomId` (map no `useChat`) e reaproveitar ao trocar de sala.
- Opcional: persistência leve (últimas N mensagens por sala) em localStorage.

## Arquivos que serão alterados (principalmente)
- UI/UX chat: `frontend/src/pages/Comunicacao/ChatInterno.tsx`
- Estado/realtime: `frontend/src/hooks/useChat.ts`, `frontend/src/services/chat.ts`
- Unread/som: `frontend/src/contexts/ChatNotificationsContext.tsx` (+ util de som)
- Migrations SQL (Supabase): `backend/src/db/migrations/*` (novas tabelas de pins/reactions etc.)

## Validação (checklist prático)
- 2 usuários logados em salas diferentes:
  - Unread badge incrementa fora da sala ativa; some ao abrir e ao chegar no fim do scroll.
  - “Digitando…” aparece e some sozinho.
  - Presença muda (online/away/offline) coerente.
  - Som toca só nas regras definidas.
  - Pin/busca/reações funcionando com realtime.
  - Scroll não “puxa” quando usuário está lendo mensagens antigas.

Se você confirmar, eu começo pelo ajuste das ações (menu/action bar) e em seguida executo a Fase 1 inteira na ordem do roadmap.