import React from 'react'
import { CatalogCrudPage } from '@/pages/CRM/Configs/CatalogCrudPage'
import { createCrmServico, deleteCrmServico, fetchCrmServicos, updateCrmServico } from '@/services/crm'

export default function Servicos() {
  return (
    <CatalogCrudPage
      title="Cadastrar Serviços"
      subtitle="Serviços e ofertas configuráveis do CRM."
      singularLabel="Serviço"
      kind="servico"
      accent="sky"
      fetchItems={async () => {
        const data = await fetchCrmServicos()
        return data.map((s) => ({
          id: s.serv_id,
          codigo: s.codigo_serv ?? null,
          situacao: s.situacao_serv ?? true,
          descricao: s.descricao_serv,
          preco: s.servicos_valor ?? 0
        }))
      }}
      createItem={async (payload) => {
        await createCrmServico({
          integ_id: null,
          situacao_serv: payload.situacao,
          descricao_serv: payload.descricao,
          obs_serv: null,
          servicos_valor: payload.preco ?? 0
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmServico(id, {
          integ_id: null,
          situacao_serv: payload.situacao,
          descricao_serv: payload.descricao,
          obs_serv: null,
          servicos_valor: payload.preco ?? 0
        })
      }}
      deleteItem={async (id) => {
        await deleteCrmServico(id)
      }}
    />
  )
}

