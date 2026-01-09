Vou realizar a refatoração completa para remover o campo `departamento` e unificar as permissões no campo `role`, utilizando a nova lista definida.

### 1. Banco de Dados (SQL)

Criarei um arquivo de migração `db/600_refactor_roles.sql` para executar as alterações no banco de dados com segurança:

* **Remover Coluna**: Excluir a coluna `departamento` e o tipo `departamento_enum`.

* **Migrar Dados Existentes**:

  * Converter `role = 'admin'` para `'ADMIN'`.

  * Converter `role = 'user'` para `'VENDEDOR'` (definido como padrão seguro para usuários comuns).

* **Atualizar Padrões**: Alterar o valor padrão da coluna `role` para `'VENDEDOR'`.

* **Atualizar Políticas de Segurança (RLS)**: Ajustar todas as políticas que verificam `role = 'admin'` para verificar `role = 'ADMIN'`.

### 2. Código Frontend (TypeScript/React)

Atualizarei a tipagem e a lógica da aplicação para refletir os novos papéis:

* **Tipos (`src/types/auth.ts`)**:

  * Remover `departamento` da interface `Profile`.

  * Atualizar `UserRole` para aceitar apenas: `'ADMIN' | 'VENDEDOR' | 'ADMINISTRATIVO' | 'FINANCEIRO' | 'LOGISTICA' | 'OFICINA' | 'TECNICO'`.

* **Contexto de Autenticação (`src/contexts/AuthContext.tsx`)**:

  * Atualizar a criação de novos perfis para usar `'VENDEDOR'` como padrão em vez de `'user'`.

* **Gestão de Usuários (`pages/Configuracoes/Usuarios.tsx`)**:

  * Atualizar a verificação de administrador (`profile.role === 'ADMIN'`).

  * Melhorar a exibição da função na lista de usuários (mostrar o nome do cargo em vez de "Usuário").

* **Proteção de Rotas (`src/routes/guards/RequireAdmin.tsx`)**:

  * Ajustar a verificação de permissão para `'ADMIN'`.

### 3. Verificação

* Validar se a aplicação compila sem erros de tipo.

* Confirmar se a verificação de administrador continua funcionando corretamente.

