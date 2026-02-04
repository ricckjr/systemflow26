import { CodeCrudPage } from '@/pages/ConfigGerais/CodeCrudPage'
import { createCrmCnaeCodigo, deleteCrmCnaeCodigo, fetchCrmCnaeCodigos, updateCrmCnaeCodigo } from '@/services/crm'

export default function Cnae() {
  return (
    <CodeCrudPage
      title="Cadastrar CNAE"
      subtitle="Cadastre códigos CNAE para usar nos clientes."
      singularLabel="CNAE"
      fetchItems={async () => {
        const data = await fetchCrmCnaeCodigos()
        return data.map((i) => ({
          id: i.cnae_id,
          codigo: i.codigo_cnae,
          descricao: i.descricao_cnae ?? null
        }))
      }}
      createItem={async (payload) => {
        await createCrmCnaeCodigo(payload)
      }}
      updateItem={async (id, payload) => {
        await updateCrmCnaeCodigo(id, payload)
      }}
      deleteItem={async (id) => {
        await deleteCrmCnaeCodigo(id)
      }}
    />
  )
}
