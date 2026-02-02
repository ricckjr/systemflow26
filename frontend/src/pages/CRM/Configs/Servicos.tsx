import React from 'react'
import { ValueCrudPage } from './ValueCrudPage'
import { createCrmServico, deleteCrmServico, fetchCrmServicos, updateCrmServico } from '@/services/crm'

export default function Servicos() {
  return (
    <ValueCrudPage
      title="Cadastrar Serviços"
      subtitle="Serviços e ofertas configuráveis do CRM."
      singularLabel="Serviço"
      accent="sky"
      fetchItems={async () => {
        const data = await fetchCrmServicos()
        return data.map(s => ({
          id: s.serv_id,
          descricao: s.descricao_serv,
          obs: s.obs_serv,
          valor: s.servicos_valor ?? 0
        }))
      }}
      createItem={async payload => {
        await createCrmServico({
          integ_id: null,
          descricao_serv: payload.descricao,
          obs_serv: payload.obs,
          servicos_valor: payload.valor ?? 0
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmServico(id, {
          integ_id: null,
          descricao_serv: payload.descricao,
          obs_serv: payload.obs,
          servicos_valor: payload.valor ?? 0
        })
      }}
      deleteItem={async id => {
        await deleteCrmServico(id)
      }}
    />
  )
}
