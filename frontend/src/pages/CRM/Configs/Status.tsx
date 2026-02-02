import React from 'react'
import { OrderedColorCrudPage } from './OrderedColorCrudPage'
import { createCrmStatus, deleteCrmStatus, fetchCrmStatus, updateCrmStatus } from '@/services/crm'

export default function Status() {
  return (
    <OrderedColorCrudPage
      title="Status CRM"
      subtitle="Configuração de status usados no CRM."
      singularLabel="Status"
      fetchItems={async () => {
        const data = await fetchCrmStatus()
        return data.map((s) => ({
          id: s.status_id,
          descricao: s.status_desc,
          obs: s.status_obs,
          ordem: s.status_ordem ?? 0,
          cor: s.status_cor
        }))
      }}
      createItem={async (payload) => {
        await createCrmStatus({
          integ_id: null,
          status_desc: payload.descricao,
          status_obs: payload.obs,
          status_ordem: payload.ordem,
          status_cor: payload.cor
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmStatus(id, {
          integ_id: null,
          status_desc: payload.descricao,
          status_obs: payload.obs,
          status_ordem: payload.ordem,
          status_cor: payload.cor
        })
      }}
      deleteItem={async (id) => {
        await deleteCrmStatus(id)
      }}
    />
  )
}
