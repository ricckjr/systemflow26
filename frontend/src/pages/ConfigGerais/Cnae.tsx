import { CodeCrudPage } from '@/pages/ConfigGerais/CodeCrudPage'
import { createCrmCnaeCodigo, deleteCrmCnaeCodigo, fetchCrmCnaeCodigos, updateCrmCnaeCodigo } from '@/services/crm'

export default function Cnae() {
  return (
    <CodeCrudPage
      title="Cadastrar CNAE"
      subtitle="Cadastre códigos CNAE para usar nos clientes."
      singularLabel="CNAE"
      fetchItems={fetchCrmCnaeCodigos}
      createItem={createCrmCnaeCodigo}
      updateItem={updateCrmCnaeCodigo}
      deleteItem={deleteCrmCnaeCodigo}
    />
  )
}

