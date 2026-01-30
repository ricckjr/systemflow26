import React from 'react'
import { ConfigCrudPage } from './ConfigCrudPage'
import { createCrmServico, deleteCrmServico, fetchCrmServicos, updateCrmServico } from '@/services/crm'

export default function Servicos() {
  return (
    <ConfigCrudPage
      title="Cadastrar Serviços"
      subtitle="Serviços e ofertas configuráveis do CRM."
      singularLabel="Serviço"
      fetchItems={async () => {
        const data = await fetchCrmServicos()
        return data.map(s => ({
          id: s.serv_id,
          id_integ: s.integ_id,
          descricao: s.descricao_serv,
          obs: s.obs_serv
        }))
      }}
      createItem={async payload => {
        await createCrmServico({
          integ_id: payload.id_integ,
          descricao_serv: payload.descricao,
          obs_serv: payload.obs,
          servicos_valor: 0
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmServico(id, {
          integ_id: payload.id_integ,
          descricao_serv: payload.descricao,
          obs_serv: payload.obs
        })
      }}
      deleteItem={async id => {
        await deleteCrmServico(id)
      }}
    />
  )
}
