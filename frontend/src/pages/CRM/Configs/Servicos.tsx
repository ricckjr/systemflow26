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
          id: s.id_serv,
          id_integ: s.id_integ,
          descricao: s.descricao_serv,
          obs: s.obs_serv
        }))
      }}
      createItem={async payload => {
        await createCrmServico({
          id_integ: payload.id_integ,
          descricao_serv: payload.descricao,
          obs_serv: payload.obs
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmServico(id, {
          id_integ: payload.id_integ,
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
