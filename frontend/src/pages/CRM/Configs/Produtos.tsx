import React from 'react'
import { ConfigCrudPage } from './ConfigCrudPage'
import { createCrmProduto, deleteCrmProduto, fetchCrmProdutos, updateCrmProduto } from '@/services/crm'

export default function Produtos() {
  return (
    <ConfigCrudPage
      title="Cadastrar Produtos"
      subtitle="Produtos disponíveis para oportunidades e propostas."
      singularLabel="Produto"
      fetchItems={async () => {
        const data = await fetchCrmProdutos()
        return data.map(p => ({
          id: p.id_prod,
          id_integ: p.id_integ,
          descricao: p.descricao_prod,
          obs: p.obs_prod
        }))
      }}
      createItem={async payload => {
        await createCrmProduto({
          id_integ: payload.id_integ,
          descricao_prod: payload.descricao,
          obs_prod: payload.obs
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmProduto(id, {
          id_integ: payload.id_integ,
          descricao_prod: payload.descricao,
          obs_prod: payload.obs
        })
      }}
      deleteItem={async id => {
        await deleteCrmProduto(id)
      }}
    />
  )
}
