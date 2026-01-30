import React from 'react'
import { ConfigCrudPage } from './ConfigCrudPage'
import { createCrmOrigemLead, deleteCrmOrigemLead, fetchCrmOrigensLead, updateCrmOrigemLead } from '@/services/crm'

export default function OrigemLeads() {
  return (
    <ConfigCrudPage
      title="Cadastrar Origem de Leads"
      subtitle="Configuração de origens utilizadas no CRM."
      singularLabel="Origem"
      fetchItems={async () => {
        const data = await fetchCrmOrigensLead()
        return data.map(o => ({
          id: o.orig_id,
          id_integ: o.integ_id,
          descricao: o.descricao_orig,
          obs: o.obs_orig
        }))
      }}
      createItem={async payload => {
        await createCrmOrigemLead({
          integ_id: payload.id_integ,
          descricao_orig: payload.descricao,
          obs_orig: payload.obs
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmOrigemLead(id, {
          integ_id: payload.id_integ,
          descricao_orig: payload.descricao,
          obs_orig: payload.obs
        })
      }}
      deleteItem={async id => {
        await deleteCrmOrigemLead(id)
      }}
    />
  )
}
