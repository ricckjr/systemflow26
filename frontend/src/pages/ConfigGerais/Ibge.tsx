import { CodeCrudPage } from '@/pages/ConfigGerais/CodeCrudPage'
import { createCrmIbgeCodigo, deleteCrmIbgeCodigo, fetchCrmIbgeCodigos, updateCrmIbgeCodigo } from '@/services/crm'

export default function Ibge() {
  return (
    <CodeCrudPage
      title="Cadastrar IBGE"
      subtitle="Cadastre códigos IBGE para usar nos clientes."
      singularLabel="IBGE"
      fetchItems={fetchCrmIbgeCodigos}
      createItem={createCrmIbgeCodigo}
      updateItem={updateCrmIbgeCodigo}
      deleteItem={deleteCrmIbgeCodigo}
    />
  )
}

