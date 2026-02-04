import { CodeCrudPage } from '@/pages/ConfigGerais/CodeCrudPage'
import { createCrmIbgeCodigo, deleteCrmIbgeCodigo, fetchCrmIbgeCodigos, updateCrmIbgeCodigo } from '@/services/crm'

export default function Ibge() {
  return (
    <CodeCrudPage
      title="Cadastrar IBGE"
      subtitle="Cadastre códigos IBGE para usar nos clientes."
      singularLabel="IBGE"
      fetchItems={async () => {
        const data = await fetchCrmIbgeCodigos()
        return data.map((i) => ({
          id: i.ibge_id,
          codigo: i.codigo_ibge,
          descricao: i.descricao_ibge ?? null
        }))
      }}
      createItem={async (payload) => {
        await createCrmIbgeCodigo(payload)
      }}
      updateItem={async (id, payload) => {
        await updateCrmIbgeCodigo(id, payload)
      }}
      deleteItem={async (id) => {
        await deleteCrmIbgeCodigo(id)
      }}
    />
  )
}
