import { DescObsCrudPage } from '@/pages/ConfigGerais/DescObsCrudPage'
import { createFinFormaPagamento, deleteFinFormaPagamento, fetchFinFormasPagamento, updateFinFormaPagamento } from '@/services/financeiro'

export default function FormasPagamento() {
  return (
    <DescObsCrudPage
      title="Cadastrar Forma de Pagamento"
      subtitle="Cadastre formas de pagamento reutilizáveis em CRM, Propostas, Pedidos, Financeiro e NF."
      singularLabel="Forma de Pagamento"
      fetchItems={async () => {
        const data = await fetchFinFormasPagamento()
        return data.map((i) => ({
          id: i.forma_id,
          descricao: i.descricao,
          observacao: (i as any).observacao ?? null
        }))
      }}
      createItem={async (payload) => {
        await createFinFormaPagamento(payload)
      }}
      updateItem={async (id, payload) => {
        await updateFinFormaPagamento(id, payload)
      }}
      deleteItem={async (id) => {
        await deleteFinFormaPagamento(id)
      }}
    />
  )
}
