import { DescObsCrudPage } from '@/pages/ConfigGerais/DescObsCrudPage'
import { createFinCondicaoPagamento, deleteFinCondicaoPagamento, fetchFinCondicoesPagamento, updateFinCondicaoPagamento } from '@/services/financeiro'

export default function CondicoesPagamento() {
  return (
    <DescObsCrudPage
      title="Cadastrar Condição de Pagamento"
      subtitle="Cadastre condições de pagamento reutilizáveis em CRM, Propostas, Pedidos, Financeiro e NF."
      singularLabel="Condição de Pagamento"
      fetchItems={async () => {
        const data = await fetchFinCondicoesPagamento()
        return data.map((i) => ({
          id: i.condicao_id,
          descricao: i.descricao,
          observacao: (i as any).observacao ?? null
        }))
      }}
      createItem={async (payload) => {
        await createFinCondicaoPagamento(payload)
      }}
      updateItem={async (id, payload) => {
        await updateFinCondicaoPagamento(id, payload)
      }}
      deleteItem={async (id) => {
        await deleteFinCondicaoPagamento(id)
      }}
    />
  )
}
