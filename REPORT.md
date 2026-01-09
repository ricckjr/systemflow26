# Relatório de Arquitetura e Deploy SystemFlow

## 1. Arquitetura

O SystemFlow foi reestruturado para separar claramente o Frontend do Backend, garantindo segurança e escalabilidade, rodando paralelo ao Supabase Self-Hosted.

### Estrutura de Pastas
- **/frontend**: Aplicação React (Vite). Responsável pela UI.
- **/backend**: API Node.js (Express). Responsável por operações administrativas seguras.
- **docker-compose.yml**: Orquestração dos containers (Backend e Frontend).

### Serviços e Portas
| Serviço | Porta Interna (Docker) | Porta Host (VPS) | URL API (Frontend) |
|---|---|---|---|
| Backend API | 7005 | 7005 | `http://localhost:7005` |
| Frontend Web | 80 | 7001 | - |

**Nota:** As portas 7005 e 7001 não devem ser expostas diretamente à internet, mas sim mapeadas pelo NGINX Proxy Manager. O Frontend foi configurado para acessar a API via `http://localhost:7005` (ideal para ambientes locais ou onde o NGINX ainda não está propagado).

## 2. Fluxo de Autenticação e Segurança

### Autenticação
1. O Frontend autentica o usuário diretamente com o Supabase usando a `VITE_SUPABASE_ANON_KEY`.
2. O Frontend recebe um JWT (Access Token).
3. Para chamadas à API (Backend), o Frontend envia este JWT no header `Authorization: Bearer <TOKEN>`.

### Validação no Backend
1. O Middleware de autenticação (`middleware/auth.js`) intercepta a requisição.
2. Verifica a validade do JWT usando `supabase.auth.getUser(token)`.
3. Consulta a tabela `profiles` para verificar:
   - Se o usuário existe.
   - Se `ativo` é `true`.
   - Qual o `cargo` do usuário.
4. Se `ativo = false`, a requisição é negada (403) e o usuário deve ser deslogado.
5. Rotas administrativas (`/admin/*`) exigem `cargo = 'ADMIN'`.

### Operações Administrativas
O Backend utiliza a `SUPABASE_SERVICE_ROLE_KEY` para realizar operações privilegiadas que o Frontend não pode fazer diretamente:
- Criar usuários (`auth.admin.createUser`)
- Desativar/Reativar usuários (Update `profiles.ativo` + Banimento no Auth)
- Excluir usuários (`auth.admin.deleteUser`)
- Resetar senhas (`auth.admin.updateUserById`)

## 3. Fluxo de Usuários

- **Criação**: Admin envia dados para `POST /admin/users`. Backend cria no Supabase Auth e garante entrada em `profiles`.
- **Desativação**: Admin chama `PUT /admin/users/:id/disable`. Backend marca `profiles.ativo = false` e invalida sessões.
- **Acesso**: Todo acesso à API valida o status `ativo`.

## 4. Como Testar e Subir

### Pré-requisitos
- Docker e Docker Compose instalados.
- Supabase rodando.
- Arquivo `.env` configurado na raiz com as chaves corretas (ver `.env.example`).

### Passo a Passo
1. **Configurar Variáveis**:
   Crie o arquivo `.env` na raiz:
   ```env
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

2. **Deploy**:
   Execute o script de deploy:
   ```bash
   ./deploy-systemflow.sh
   ```
   *No Windows (PowerShell), você pode rodar `docker-compose up -d --build` diretamente.*

3. **Configurar NGINX Proxy Manager**:
   - Crie um Proxy Host para `api.systemflow.apliflow.com` apontando para `IP_DA_VPS:7005`.
   - Crie um Proxy Host para `systemflow.apliflow.com` apontando para `IP_DA_VPS:7001`.

4. **Verificação**:
   - Acesse `https://systemflow.apliflow.com`.
   - Tente logar.
   - Teste funcionalidades administrativas (se for Admin).

## 5. Manutenção
- Para atualizar o código, basta fazer `git pull` e rodar `./deploy-systemflow.sh` novamente.
- O script fará o rebuild dos containers sem afetar o Supabase.
