## Escopo
- Ajustar **menu**, **rotas** e **títulos** para ficar exatamente no formato solicitado.
- Manter compatibilidade: rotas antigas continuam funcionando via redirects.
- Sem mexer em backend/banco.

## Mudanças no Menu (Sidebar)
Atualizar [Sidebar.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Sidebar.tsx) para ficar **nesta ordem** e com **estes labels/paths**:
1) **DASHBOARD**
- Comercial → `/app/dashboard/comercial`

2) **COMUNIDADE**
- Chat → `/app/comunidade/chat` (novo canônico)
- InstaFlow → `/app/comunidade`
- Tarefas → `/app/comunidade/taskflow` (renomeia “TaskFlow”)
- Agenda → `/app/comunidade/agenda` (novo)
- Calendário → `/app/comunidade/calendario` (novo)

3) **CADASTROS**
- Clientes → `/app/cadastros/clientes`
- Contatos → `/app/cadastros/contatos`
- Fornecedores → `/app/cadastros/fornecedores`

4) **CRM**
- Pipeline (Kanban) → `/app/crm/oportunidades-kanban` (renomeia “Cadastrar Oportunidades (Kanban)”)
- Oportunidades → `/app/crm/oportunidades`
- Propostas → `/app/crm/propostas`
- Vendedores → `/app/crm/vendedores`

5) **CONFIGS CRM**
- Origem de Leads → `/app/crm/configs/origem-leads` (remove “Cadastrar” do label)
- Motivos → `/app/crm/configs/motivos`
- Verticais → `/app/crm/configs/verticais`
- Produtos → `/app/crm/configs/produtos`
- Serviços → `/app/crm/configs/servicos`

6) **PRODUÇÃO**
- Kanban Produção → `/app/producao/ordens-servico` (renomeia “Ordens de Serviço”)
- Equipamentos → `/app/producao/equipamentos`
- Certificado garantia → `/app/producao/certificado-garantia` (novo)

7) **FROTA**
- Veículos → `/app/frota/veiculos`
- Diário de Bordo → `/app/frota/diario-de-bordo`

8) **UNIVERSIDADE**
- Catálogos → `/app/universidade/catalogos`
- Manuais → `/app/universidade/manuais`
- Treinamentos → `/app/universidade/treinamentos`
- Instruções de Trabalho → `/app/universidade/instrucoes-de-trabalho`

9) **SMARTFLOW**
- Atendimentos → `/app/smartflow/atendimentos` (novo canônico; renderiza a página atual do FlowSmart)
- Kanban de Fluxos → `/app/smartflow/kanban-fluxos` (novo placeholder)

**Ajuste adicional no Sidebar (bolinha de chat):**
- Hoje a bolinha aparece quando `item.modulo === 'comunicacao'`. Vou mudar para aparecer no grupo **COMUNIDADE** (já que o Chat vai para lá), mantendo o comportamento de “tem não lidas”.

## Rotas (Router) + Compatibilidade
Atualizar [routes/index.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/routes/index.tsx):
- Alterar o index de `/app` para redirecionar para `/app/dashboard/comercial`.
- Adicionar rotas novas:
  - `comunidade/chat` → reusar página atual do chat (import atual de `@/pages/Comunicacao/ChatInterno`)
  - `comunidade/agenda` → nova página placeholder
  - `comunidade/calendario` → nova página placeholder
  - `producao/certificado-garantia` → nova página placeholder
  - `smartflow/atendimentos` → reusar página atual do FlowSmart (import atual de `@/pages/Comunicacao/FlowSmart`)
  - `smartflow/kanban-fluxos` → nova página placeholder
- Manter redirects de compatibilidade:
  - `comunicacao/chat` → `/app/comunidade/chat`
  - `comunicacao/flowsmart` → `/app/smartflow/atendimentos`
  - redirects já existentes de `comercial/*` permanecem.

## Páginas novas (placeholders “Em breve”)
Criar páginas novas no padrão visual já usado no projeto:
- `frontend/src/pages/Comunidade/Agenda.tsx`
- `frontend/src/pages/Comunidade/Calendario.tsx`
- `frontend/src/pages/Producao/CertificadoGarantia.tsx`
- `frontend/src/pages/SmartFlow/KanbanFluxos.tsx`

## Títulos (Header)
Atualizar [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx) para mapear os novos `pathname`:
- `/app/comunidade/chat|agenda|calendario`
- `/app/smartflow/atendimentos|kanban-fluxos`
- `/app/producao/certificado-garantia`
- Ajustar labels para bater com os nomes finais (ex.: “KANBAN PRODUÇÃO”, “PIPELINE (KANBAN)”, etc.).

## Verificação
- Rodar build do frontend para garantir que não há erro de TS/rota.
- Conferir rapidamente:
  - Sidebar ativa corretamente
  - Redirects antigos funcionam
  - Header mostra títulos corretos

Se estiver ok, eu executo exatamente essas alterações (Sidebar/Router/Header + páginas placeholder).