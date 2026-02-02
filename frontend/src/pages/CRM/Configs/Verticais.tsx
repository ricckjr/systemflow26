import React from 'react'
import { ConfigCrudPage } from './ConfigCrudPage'
import { createCrmVertical, deleteCrmVertical, fetchCrmVerticais, updateCrmVertical } from '@/services/crm'

export default function Verticais() {
  return (
    <ConfigCrudPage
      title="Cadastrar Verticais"
      subtitle="Verticais e segmentos utilizados no CRM."
      singularLabel="Vertical"
      fetchItems={async () => {
        const data = await fetchCrmVerticais()
        return data.map(v => ({
          id: v.vert_id,
          descricao: v.descricao_vert,
          obs: v.obs_ver
        }))
      }}
      createItem={async payload => {
        await createCrmVertical({
          integ_id: null,
          descricao_vert: payload.descricao,
          obs_ver: payload.obs
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmVertical(id, {
          integ_id: null,
          descricao_vert: payload.descricao,
          obs_ver: payload.obs
        })
      }}
      deleteItem={async id => {
        await deleteCrmVertical(id)
      }}
    />
  )
}
