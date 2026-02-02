import React from 'react'
import { ValueCrudPage } from './ValueCrudPage'
import { createCrmProduto, deleteCrmProduto, fetchCrmProdutos, updateCrmProduto } from '@/services/crm'

export default function Produtos() {
  return (
    <ValueCrudPage
      title="Cadastrar Produtos"
      subtitle="Produtos disponíveis para oportunidades e propostas."
      singularLabel="Produto"
      accent="orange"
      fetchItems={async () => {
        const data = await fetchCrmProdutos()
        return data.map(p => ({
          id: p.prod_id,
          descricao: p.descricao_prod,
          obs: p.obs_prod,
          valor: p.produto_valor ?? 0
        }))
      }}
      createItem={async payload => {
        await createCrmProduto({
          integ_id: null,
          descricao_prod: payload.descricao,
          obs_prod: payload.obs,
          produto_valor: payload.valor ?? 0
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmProduto(id, {
          integ_id: null,
          descricao_prod: payload.descricao,
          obs_prod: payload.obs,
          produto_valor: payload.valor ?? 0
        })
      }}
      deleteItem={async id => {
        await deleteCrmProduto(id)
      }}
    />
  )
}
