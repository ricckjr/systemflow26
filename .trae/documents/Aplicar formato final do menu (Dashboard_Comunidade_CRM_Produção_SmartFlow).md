## Situação atual (para referência)
- Sidebar hoje tem: DASHBOARD, CADASTROS, CRM, CONFIGS CRM, COMUNIDADE, COMUNICAÇÃO, PRODUÇÃO, FROTA, UNIVERSIDADE em [Sidebar.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Sidebar.tsx#L29-L119).
- As rotas atuais ainda apontam o index de `/app` para `/app/comunidade` em [routes/index.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/routes/index.tsx#L58-L66).
- Chat/FlowSmart hoje ficam em `/app/comunicacao/*` e ainda não existem as rotas canônicas `/app/comunidade/chat` e `/app/smartflow/atendimentos`.

## O que vou implementar (exatamente como seu formato final)

### 1) Sidebar (ordem + labels + itens)
Atualizar `navItems` em [Sidebar.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Sidebar.tsx) para ficar nesta ordem:
1. **DASHBOARD**
   - Comercial → `/app/dashboard/comercial`
2. **COMUNIDADE**
   - Chat → `/app/comunidade/chat`
   - InstaFlow → `/app/comunidade`
   - Tarefas (renomeia TaskFlow) → `/app/comunidade/taskflow`
   - Agenda → `/app/comunidade/agenda`
   - Calendário → `/app/comunidade/calendario`
3. **CADASTROS**
   - Clientes/Contatos/Fornecedores (mantém como está)
4. **CRM**
   - Pipeline (Kanban) (renomeia “Cadastrar Oportunidades (Kanban)”) → `/app/crm/oportunidades-kanban`
   - Oportunidades → `/app/crm/oportunidades`
   - Propostas → `/app/crm/propostas`
   - Vendedores → `/app/crm/vendedores`
5. **CONFIGS CRM**
   - Origem de Leads / Motivos / Verticais / Produtos / Serviços (remove “Cadastrar” dos labels)
6. **PRODUÇÃO**
   - Kanban Produção (renomeia “Ordens de Serviço”) → `/app/producao/ordens-servico`
   - Equipamentos → `/app/producao/equipamentos`
   - Certificado garantia → `/app/producao/certificado-garantia`
7. **FROTA**
8. **UNIVERSIDADE**
9. **SMARTFLOW**
   - Atendimentos → `/app/smartflow/atendimentos` (renderiza a tela atual do FlowSmart)
   - Kanban de Fluxos → `/app/smartflow/kanban-fluxos` (placeholder)

### 2) Rotas novas + compatibilidade
Atualizar [routes/index.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/routes/index.tsx) para:
- Ajustar rota inicial do app:
  - `/app` (index) → redirect para `/app/dashboard/comercial`
- Criar rotas canônicas novas:
  - `/app/comunidade/chat` → usa a página atual do chat (hoje em `/app/comunicacao/chat`)
  - `/app/comunidade/agenda` (placeholder)
  - `/app/comunidade/calendario` (placeholder)
  - `/app/producao/certificado-garantia` (placeholder)
  - `/app/smartflow/atendimentos` → usa a página atual FlowSmart
  - `/app/smartflow/kanban-fluxos` (placeholder)
- Manter redirects de compatibilidade:
  - `/app/comunicacao/chat` → `/app/comunidade/chat`
  - `/app/comunicacao/flowsmart` → `/app/smartflow/atendimentos`
  - Redirects existentes de `/app/comercial/*` permanecem como já estão.

### 3) Páginas placeholders
Criar páginas “Em breve” (mesmo padrão das outras) para:
- Comunidade: `Agenda.tsx` e `Calendario.tsx`
- Produção: `CertificadoGarantia.tsx`
- SmartFlow: `KanbanFluxos.tsx`

### 4) Header (títulos)
Atualizar o mapa de títulos em [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx#L39-L74) para os novos paths:
- Comunidade/Chat/Agenda/Calendário
- Produção/Certificado garantia
- SmartFlow/Atendimentos/Kanban de fluxos
- Ajustar título de Produção para “KANBAN PRODUÇÃO” no path `/app/producao/ordens-servico`.

### 5) Bolinha de chat não lido
A bolinha hoje aparece quando `item.modulo === 'comunicacao'`. Vou mover essa condição para o grupo **COMUNIDADE** em [Sidebar.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Sidebar.tsx) para continuar aparecendo no menu correto após a mudança do Chat.

## Verificação
- Rodar build do frontend para garantir ausência de erros.
- Conferir que:
  - Rotas novas existem (sem 404)
  - Redirects antigos funcionam
  - Sidebar marca item ativo corretamente
  - Títulos do Header batem com o novo menu

Se confirmar este plano, eu aplico as alterações nos arquivos e adiciono as páginas placeholder.