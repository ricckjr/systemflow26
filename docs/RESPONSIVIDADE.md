# Responsividade e Modais

## Objetivos
- Garantir adaptação consistente em mobile, tablet e desktop
- Otimizar modais para redimensionamento automático, scroll interno e acessibilidade
- Manter consistência visual e performance

## Principais Ajustes
- Estilos globais de modal: `.modal-overlay`, `.modal-dialog`, `.modal-header`, `.modal-body`, `.modal-footer`
- Media queries em `style.css` para reduzir padding e ajustar tipografia em telas pequenas
- Bloqueio de scroll do body com `useScrollLock`
- Fechamento via tecla `Esc` em modais e menu móvel
- Atributos de acessibilidade: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Corpo dos modais com `overflow-y: auto` e `max-height: min(90vh, calc(100vh - 32px))`

## Arquivos Alterados
- `style.css`: classes de modal e media queries
- `hooks/useScrollLock.ts`: hook para bloquear scroll
- `components/Layout.tsx`: modal de perfil atualizado
- `pages/TaskFlow.tsx`: modais de nova tarefa e detalhes atualizados
- `pages/Configuracoes/Usuarios.tsx`: modal de novo usuário atualizado

## Checklist de Testes
- Navegadores: Chrome, Firefox, Safari, Edge
- Tamanhos: 360x640, 768x1024, 1280x800, 1920x1080
- Orientação: portrait e landscape
- Modais:
  - Conteúdo não ultrapassa viewport
  - Scroll interno funciona e mantém botões visíveis
  - Botão fechar e ações acessíveis em todas resoluções
  - Fechamento por `Esc` e clique no overlay
  - Foco inicial em elemento interativo do modal
- Acessibilidade:
  - Contraste adequado
  - Tipografia legível
  - Navegação via teclado entre campos e ações
- Performance:
  - Sem reflows excessivos ao abrir/fechar modais
  - Sem scroll duplo (body bloqueado)

## Observações
- Modais seguem Tailwind utilitários existentes; classes globais complementam comportamento responsivo
- Para foco-trap completo, pode-se introduzir uma lib dedicada futuramente

