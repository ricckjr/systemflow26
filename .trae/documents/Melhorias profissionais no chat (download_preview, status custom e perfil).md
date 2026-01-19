## Objetivos

* Permitir baixar qualquer anexo com 1 clique.

* Para imagens, abrir um preview em tela cheia (zoom/fechar/baixar).

* Adicionar um campo para status (texto custom tipo “Em reunião”).

* Ao clicar na foto/nome do usuário no chat, abrir um modal com os dados do perfil.

## Download + Preview de Anexos

* Refatorar o renderer de attachments em [ChatInterno.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunicacao/ChatInterno.tsx#L605-L626) criando um componente de UI (ex.: `ChatAttachmentCard`).

* Implementar ação “Baixar” para todos os tipos:

  * Preferência: baixar via `fetch(url) -> blob -> URL.createObjectURL` para funcionar bem mesmo com CORS, e sugerir o nome correto (`att.name`).

  * Fallback: link `<a href target="_blank" rel="noreferrer" download>`.

* Imagens:

  * Tornar a imagem clicável e abrir um modal “lightbox” (`fixed inset-0` + backdrop) seguindo o padrão já usado no modal de “Nova Conversa”.

  * Modal com: imagem `object-contain`, botão fechar (X), botão baixar, botão abrir em nova aba.

  * Fechar por clique no backdrop e tecla ESC.

* Documentos/áudio/vídeo:

  * Exibir card com ícone, nome, tamanho (quando houver), botões “Abrir” e “Baixar”.

  * (Opcional) Suportar `video` na UI, já que o tipo existe no modelo.

* Ajuste recomendado (extra): ampliar whitelist de MIME types do upload para áudio (`audio/webm`, `audio/mp4`) e vídeo, porque o chat já tenta enviar áudio.

## Campo para inserir status (texto custom)

* Estender a presença para suportar, além do status (online/busy/away/offline), um `statusText` (string) definido pelo usuário.

* Persistência do texto:

  * Curto prazo (sem backend): salvar em `localStorage` por `userId` e enviar no payload do presence (`track({ status, statusText })`).

  * (Opcional, mais completo): criar coluna no `profiles` (ex.: `status_message`) + ajustar RPC para persistir.

* UI:

  * No menu “Meu Status” (ChatInterno), adicionar um input “Mensagem de status” (ex.: placeholder “Em reunião / Em atendimento”).

  * Exibir `statusText` abaixo do label de status no header do chat e no modal de perfil.

## Abrir perfil ao clicar na foto do usuário

* No header do chat (avatar/nome em [ChatInterno.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comunicacao/ChatInterno.tsx#L538-L559)), adicionar `onClick` para abrir um modal “Perfil do usuário”.

* Modal de perfil:

  * Mostrar: avatar, nome, cargo, email\_login, telefone, ramal, ativo, status atual e statusText.

  * Buscar dados do usuário por id no Supabase ao abrir (ou reutilizar `allUsers`/`room.members.profile` como cache e atualizar via fetch).

  * Fechar por ESC/backdrop.

* (Opcional) Também habilitar clique no avatar do usuário na lista de “Nova Conversa” para abrir o perfil.

## Verificação

* Validar na UI:

  * Enviar imagem/documento/áudio e confirmar preview + download.

  * Navegar entre páginas e confirmar que status permanece online/away corretamente.

  * Definir statusText e confirmar que aparece para outros usuários (via presence).

  * Clicar no avatar do contato e abrir modal com dados.

* Rodar `vite build` para garantir que tudo compila.

Se você confirmar, eu implemento tudo isso direto no frontend seguindo o estilo atual (Tailwind + modais inline) e deixo os componentes bem reaproveitáveis.

Otimize a qualidade das imagens de perfil para garantir máxima nitidez e resolução. Implemente as seguintes melhorias:  1. Processamento de imagem:    - Aplique algoritmos de sharpening para melhorar a definição    - Utilize redimensionamento com interpolação de alta qualidade (Lanczos ou bicúbica)    - Mantenha a proporção original para evitar distorções  2. Configurações de saída:    - Defina qualidade mínima de 90% para compressão JPEG    - Mantenha metadados EXIF quando possível    - Considere formatos sem perdas para imagens pequenas  3. Requisitos técnicos:    - Resolução mínima de 300x300 pixels    - Suporte a perfis de cor sRGB    - Taxa de compressão ajustável conforme necessidade  4. Testes obrigatórios:    - Verifique a nitidez em diferentes dispositivos e tamanhos de exibição    - Compare antes/depois usando métricas objetivas (PSNR, SSIM)    - Valide em navegadores e aplicativos móveis  5. Entregáveis:    - Imagens processadas com qualidade visivelmente superior    - Documentação dos parâmetros utilizados    - Relatório de comparação de qualidade
