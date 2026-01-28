## Levantamento (estado atual)
- O menu lateral é definido em [Sidebar.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Sidebar.tsx) via `navItems`.
- As rotas do app ficam em [routes/index.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/routes/index.tsx) (React Router).
- O título no topo (Header) é um mapa de `pathname -> label` em [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx).
- Hoje existe o módulo “COMERCIAL” com:
  - `/app/comercial/overview` → [VisaoGeral.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comercial/VisaoGeral.tsx)
  - `/app/comercial/vendedores` → [Vendedores.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comercial/Vendedores.tsx)
  - `/app/comercial/oportunidades` → [Oportunidades.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comercial/Oportunidades.tsx)

## Decisões para “mudar pouca coisa” (compatibilidade)
- Criar novas rotas com nomes novos (Dashboard/CRM/Cadastros/Configs CRM).
- Manter as rotas antigas funcionando via redirecionamento (para não quebrar favoritos/links), por exemplo:
  - `/app/comercial/overview` → redirect para a nova rota do Dashboard
  - `/app/comercial/vendedores` → redirect para a nova rota de CRM
  - `/app/comercial/oportunidades` → redirect para a nova rota de CRM

## Novo desenho de menus (Sidebar)
1) Menu: **DASHBOARD**
- **Comercial** (aponta para a página que hoje é “Visão Geral”)

2) Menu: **CADASTROS**
- Clientes
- Contatos
- Fornecedores

3) Menu: **CRM** (renomeia o menu “COMERCIAL”)
- Cadastrar Oportunidades (Kanban)
- Oportunidades
- Propostas
- Vendedores

4) Menu: **CONFIGS CRM**
- Cadastrar Origem de Leads
- Cadastrar Motivos
- Cadastrar Verticais
- Cadastrar Produtos
- Cadastrar Serviços

## Rotas propostas (paths)
- **Dashboard**
  - `/app/dashboard/comercial` → reutiliza o componente atual de Visão Geral (renomeando textos exibidos para “Comercial”).
  - Redirect legado: `/app/comercial/overview` → `/app/dashboard/comercial`

- **CRM**
  - `/app/crm/oportunidades-kanban` → nova página (inicialmente “Em breve” ou Kanban, conforme você preferir).
  - `/app/crm/oportunidades` → reutiliza a página atual [Oportunidades.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comercial/Oportunidades.tsx)
  - `/app/crm/vendedores` → reutiliza [Vendedores.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Comercial/Vendedores.tsx)
  - `/app/crm/propostas` → alias para [Propostas.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Producao/Propostas.tsx) (sem mudar a implementação).
  - Redirects legados:
    - `/app/comercial/vendedores` → `/app/crm/vendedores`
    - `/app/comercial/oportunidades` → `/app/crm/oportunidades`

- **Cadastros** (novas páginas)
  - `/app/cadastros/clientes`
  - `/app/cadastros/contatos`
  - `/app/cadastros/fornecedores`

- **Configs CRM** (novas páginas)
  - `/app/crm/configs/origem-leads`
  - `/app/crm/configs/motivos`
  - `/app/crm/configs/verticais`
  - `/app/crm/configs/produtos`
  - `/app/crm/configs/servicos`

## Páginas novas (mínimas)
- Criar páginas simples “Em breve” seguindo o padrão de UI de [Manuais.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/pages/Universidade/Manuais.tsx) para:
  - Cadastros (Clientes/Contatos/Fornecedores)
  - Configs CRM (Origem/Motivos/Verticais/Produtos/Serviços)
  - (Opcional) Cadastrar Oportunidades (Kanban), caso o Kanban não seja implementado agora.

## Ajustes de textos/títulos
- Atualizar o título do Header em [Header.tsx](file:///c:/Users/Ricck%20Nascimento/Documents/systemflow26/frontend/src/components/layout/Header.tsx) para os novos `pathname`.
- Atualizar o H1 dentro da página atual de “Visão Geral” para exibir “Comercial” quando acessada via Dashboard.

## Permissões (assunção prática)
- Manter CRM e Dashboard acessíveis a qualquer usuário logado.
- Colocar **CONFIGS CRM** protegido por admin (`RequireAdmin`), por ser área de configuração.
  - Se você quiser que não seja admin-only, eu deixo sem o guard.

## Verificação (quando sair do modo plano)
- Rodar o frontend e navegar pelos itens novos, garantindo:
  - Nenhum link 404
  - Redirects antigos funcionando
  - Títulos do Header corretos
  - Sidebar destacando item ativo corretamente

Se você aprovar, eu implemento exatamente isso (menu + rotas + redirects + páginas mínimas), sem mexer em backend nem banco.