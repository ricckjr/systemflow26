# 🚀 Execução da Fase 1: Correções Críticas

Conforme solicitado, focaremos nos **ganhos imediatos de performance** (Pareto 80/20).

## 📋 Tarefas a Executar

### 1. 🛠️ Otimizar Frontend (Redução de Payload)
*   **Arquivo**: `frontend/src/services/crm.ts`
    *   **Ação**: Substituir `select('*')` por `select('id_oportunidade, cliente, valor_proposta, status, etapa, ...')`.
    *   **Ganho**: Redução drástica no tamanho do JSON baixado (evita baixar descrições longas na listagem).
*   **Arquivo**: `frontend/src/services/taskflow.ts`
    *   **Ação**: Otimizar `fetchUnifiedTasks`.
    *   **Detalhe**: Remover joins aninhados de `comments` e `assignees` (que devem ser carregados apenas ao abrir o card).
    *   **Ganho**: Query SQL mais leve e resposta mais rápida.

### 2. 🔐 Blindar Segurança (Backend)
*   **Arquivo**: Novo script SQL `db/secure_profiles_rls.sql`
    *   **Ação**: Alterar políticas da tabela `profiles`.
    *   **Detalhe**:
        *   Manter `SELECT` público (necessário para o sistema funcionar).
        *   Restringir `UPDATE` e `DELETE` apenas para o dono do perfil (`auth.uid() = id`) ou Admins.
    *   **Ganho**: Segurança imediata contra edições maliciosas/acidentais.

---

### ✅ Checklist de Validação
Após as alterações, verificarei:
1.  Se a listagem do CRM continua carregando os dados corretamente (sem campos faltando).
2.  Se o Kanban do TaskFlow monta as colunas e cards corretamente.
3.  Se um usuário comum **não** consegue editar o perfil de outro (via SQL/Supabase).

Podemos prosseguir com a aplicação dessas correções?
