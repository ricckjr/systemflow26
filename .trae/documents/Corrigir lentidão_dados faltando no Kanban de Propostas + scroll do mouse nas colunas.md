## Escopo e Regras

* Implementar o padrão de permissões por menu/módulo: VIEW / EDIT / CONTROL.

* Aplicar SOMENTE nos módulos: DASHBOARD, UNIVERSIDADE, CRM, PRODUCAO, FROTA, SMARTFLOW, CONFIGURACOES.

* COMUNIDADE fica fora do escopo: sem novas permissões, sem “ver tudo”, sem refatorar RLS/regras/menus.

## Diagnóstico do Estado Atual

* RBAC atual é baseado em `public.perfis`, `public.permissoes`, `public.perfil_permissoes`, `public.profile_perfis` e função `public.has_permission`.

* Existem permissões legadas (MANAGE/CREATE/EDIT/DELETE) e parte do app já faz gating de menu/rotas, mas ainda não no contrato View/Edit/Control e não há hierarquia formal.

* Comunidade (TaskFlow/Calendário/Chat/InstaFlow) já tem RLS e regras de compartilhamento próprias; isso permanecerá intacto.

## Plano (Backend/DB)

### 1) Migrations: criar permissões VIEW/EDIT/CONTROL por módulo

* Criar uma migration nova que:

  * Insere em `public.permissoes` (ON CONFLICT) os pares (modulo, acao) para:

    * DASHBOARD: VIEW/EDIT/CONTROL

    * UNIVERSIDADE: VIEW/EDIT/CONTROL

    * CRM: VIEW/EDIT/CONTROL

    * PRODUCAO: VIEW/EDIT/CONTROL

    * FROTA: VIEW/EDIT/CONTROL

    * SMARTFLOW: VIEW/EDIT/CONTROL

    * CONFIGURACOES: VIEW/EDIT/CONTROL

  * NÃO cria nada para COMUNIDADE.

### 2) Compatibilidade e Hierarquia

* Atualizar `public.has_permission(user_id, modulo, acao)` para respeitar hierarquia (sem quebrar legado):

  * Se pedir VIEW → aceitar VIEW ou EDIT ou CONTROL.

  * Se pedir EDIT → aceitar EDIT ou CONTROL.

  * Se pedir CONTROL → aceitar somente CONTROL.

  * Para ações legadas (MANAGE/CREATE/EDIT/DELETE) manter comportamento atual (match exato).

* Criar backfill em migration:

  * Onde existir `*:MANAGE` (legado), inserir `*:CONTROL` equivalente (por perfil) quando fizer sentido.

  * Inserir VIEW/EDIT implícitos apenas se necessário para compatibilidade (ou confiar totalmente na hierarquia da função).

### 3) Atribuição padrão por perfil

* Em migration:

  * ADMINISTRADOR recebe CONTROL em todos os módulos aplicáveis.

  * COMERCIAL recebe CRM:VIEW + CRM:EDIT.

  * Demais perfis recebem apenas VIEW (por enquanto) nos módulos necessários (padrão inicial).

### 4) RLS por módulo (fora COMUNIDADE)

* Criar migrations RLS por “família” de tabelas, usando `IF to_regclass(...) IS NOT NULL`.

* Mapear ownership real por tabela e aplicar regras:

  * Sem CONTROL: owner-only para ver/editar quando fizer sentido.

  * Com CONTROL: escopo global.

  * Para tabelas globais: VIEW libera SELECT; EDIT libera INSERT/UPDATE; CONTROL libera CRUD.

* Alvos conhecidos (a confirmar por schema):

  * CRM: `crm_oportunidades` (owner via `id_vendedor`), `clientes`/`clientes_contatos` (owner via `user_id`).

  * UNIVERSIDADE: `universidade_catalogos` (global; tem `created_by` mas SELECT deve ser global com VIEW).

  * PRODUCAO: `omie_servics`, `servics_equipamento`, `servics_historico` (global; controlar por VIEW/EDIT/CONTROL).

  * FROTA: `frota_veiculos`, `frota_diario_bordo` (global; controlar por VIEW/EDIT/CONTROL).

  * SMARTFLOW: se não houver tabelas (hoje parece mock), manter só gating de UI; se existirem tabelas, aplicar o mesmo padrão.

## Plano (Backend API)

* Ajustar o enforcement do router `/admin` para usar `CONFIGURACOES:CONTROL` (mantendo compatibilidade via backfill e/ou hierarquia do `has_permission`).

* Manter os endpoints RBAC existentes (`/admin/rbac/*`) sem mudanças de contrato.

## Plano (Frontend)

### 1) Sidebar

* Garantir que:

  * COMUNIDADE fique sempre visível e sem gating.

  * Todos os outros menus apareçam apenas com `MODULO:VIEW`.

  * Subitens administrativos usem `MODULO:CONTROL`.

  * Ajustar UNIVERSIDADE para deixar de ser “sempre visível” e passar a depender de `UNIVERSIDADE:VIEW`.

### 2) Rotas

* Aplicar guards:

  * Rotas principais → RequirePermission(MODULO, VIEW).

  * CRUD/manutenção → RequirePermission(MODULO, EDIT).

  * Admin → RequirePermission(MODULO, CONTROL).

  * COMUNIDADE: não adicionar novos guards nem alterar comportamento.

### 3) Hierarquia no frontend

* Atualizar `can(modulo, acao)` (AuthContext) para entender a hierarquia VIEW/EDIT/CONTROL (espelhando o backend).

### 4) UI de Permissões

* Atualizar a tela de permissões para:

  * Mostrar somente os módulos aplicáveis (sem COMUNIDADE).

  * Exibir checkboxes View / Criar-Editar / Control.

  * Aplicar lógica de hierarquia na UI (marcar View automaticamente quando Edit/Control for marcado, e impedir estado inválido).

## Validação

* Garantir que:

  * Menus somem quando VIEW não está marcado (exceto COMUNIDADE).

  * EDIT não dá acesso a ver “de todos”.

  * CONTROL libera CRUD completo e visão global.

  * COMUNIDADE permanece intacta.

* Rodar build do frontend.

* Checar se a função `get_my_permissions()` continua retornando corretamente e se os guards do frontend funcionam com as novas ações.

## Entregáveis

* Novas migrations SQL (RBAC + hierarquia + RLS dos módulos aplicáveis).

* Ajustes no backend (`/admin` exigindo CONFIGURACOES:CONTROL).

* Ajustes no Sidebar, rotas, hierarquia `can()` e UI de permissões.

* Compatibilidade com permissões antigas mantida.

