## Diagnóstico (o que está quebrando)
- O erro `23502 ... column "content" ... violates not-null constraint` acontece porque o insert em `chat_messages` está enviando `content = null` quando a mensagem é só anexo.
- Isso vem do service [chat.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/services/chat.ts#L187-L226): `content: content?.trim() ? content : null`.
- Em uploads (imagem/documento/áudio) o frontend chama `sendMessage('', [attachment])` ([ChatInterno.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunicacao/ChatInterno.tsx#L305-L359)), então vira `null` e o banco rejeita (a tabela está com `content TEXT NOT NULL` no rebuild: [20260115_fix_chat_rls_v3_rebuild.sql](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/src/db/migrations/20260115_fix_chat_rls_v3_rebuild.sql#L42-L52)).
- O badge do botão “Mensagens” depende de eventos realtime em `chat_notifications` no [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx#L188-L216). Se o realtime não estiver publicando `chat_notifications` ou a trigger/migrations não estiverem aplicadas, o badge não atualiza.

## Correção 1: permitir enviar imagens/arquivos/áudio (sem quebrar UI)
- Ajustar `chatService.sendMessage` em [chat.ts](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/services/chat.ts#L187-L226) para:
  - Nunca mandar `content = null`.
  - Usar `contentTrim = content.trim()`.
  - Se `contentTrim` vazio e **não** tem anexos: bloquear (erro “Mensagem vazia”).
  - Se `contentTrim` vazio e **tem** anexos: inserir `content: ''` (string vazia) para satisfazer `NOT NULL` sem aparecer texto extra no bubble.
- Manter o resto da tela igual (o `ChatInterno` já renderiza anexos e só mostra `{msg.content && ...}`, então `''` não aparece).

## Correção 2: fazer o badge e a lista de notificações refletirem anexos
- Atualizar o fetch da lista de notificações de chat no [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx#L54-L70) para buscar também `attachments` do `chat_messages` (hoje só busca `content`).
- Ajustar o “preview” exibido no dropdown/badge para:
  - Mostrar `content` se existir.
  - Senão, se houver `attachments`, mostrar `📎 Anexo` / `🎵 Áudio` / `🖼️ Imagem` conforme tipo.

## Correção 3: toast no canto inferior esquerdo com barra de tempo
- Implementar um componente simples de toast (sem biblioteca externa) com:
  - Posição `fixed bottom-4 left-4`.
  - Texto: `Fulano mandou mensagem` + preview (conteúdo ou fallback de anexo).
  - Barra de progresso animada (ex.: 5s) e auto-dismiss.
  - Clique no toast navega para o chat.
- Ligar esse toast ao evento realtime de `chat_notifications`:
  - No handler do `INSERT` (onde hoje só incrementa contador), buscar os detalhes do remetente e da mensagem (join `profiles` + `chat_messages(content, attachments)`), então disparar o toast.

## Correção 4 (robustez): garantir que o realtime do Supabase realmente dispare
- Conferir que `chat_notifications` está no publication `supabase_realtime` (há migration pronta para isso: [20260115_fix_chat_final_v4.sql](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/backend/src/db/migrations/20260115_fix_chat_final_v4.sql#L105-L114)).
- Se no seu ambiente isso ainda não estiver aplicado, aplicar a migration equivalente no backend/supabase para:
  - garantir trigger `trigger_notify_chat_message` existe,
  - garantir `ALTER PUBLICATION ... ADD TABLE public.chat_notifications`.

## Verificação (antes de te devolver)
- Validar no navegador:
  - Envio de imagem/documento/áudio funciona (não aparece mais erro 23502).
  - Recebimento de mensagem de outro usuário incrementa o badge no botão “Mensagens”.
  - Ao receber mensagem, aparece o toast no canto inferior esquerdo com a barra de tempo e some sozinho.
  - Clique no toast abre a tela de chat (opcionalmente já focando a conversa do `room_id`, se implementarmos o parâmetro via URL).
