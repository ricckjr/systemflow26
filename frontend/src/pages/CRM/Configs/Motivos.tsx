import React from 'react'
import { ConfigCrudPage } from './ConfigCrudPage'
import { createCrmMotivo, deleteCrmMotivo, fetchCrmMotivos, updateCrmMotivo } from '@/services/crm'

export default function Motivos() {
  return (
    <ConfigCrudPage
      title="Cadastrar Motivos"
      subtitle="Motivos e classificações utilizadas no CRM."
      singularLabel="Motivo"
      fetchItems={async () => {
        const data = await fetchCrmMotivos()
        return data.map(m => ({
          id: m.motiv_id,
          id_integ: m.integ_id,
          descricao: m.descricao_motiv,
          obs: m.obs_motiv
        }))
      }}
      createItem={async payload => {
        await createCrmMotivo({
          integ_id: payload.id_integ,
          descricao_motiv: payload.descricao,
          obs_motiv: payload.obs
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmMotivo(id, {
          integ_id: payload.id_integ,
          descricao_motiv: payload.descricao,
          obs_motiv: payload.obs
        })
      }}
      deleteItem={async id => {
        await deleteCrmMotivo(id)
      }}
    />
  )
}
