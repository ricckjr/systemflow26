import React from 'react'
import { CatalogCrudPage } from './CatalogCrudPage'
import { createCrmProduto, deleteCrmProduto, fetchCrmProdutos, updateCrmProduto } from '@/services/crm'

export default function Produtos() {
  return (
    <CatalogCrudPage
      title="Cadastrar Produtos"
      subtitle="Produtos disponíveis para propostas comerciais."
      singularLabel="Produto"
      kind="produto"
      accent="orange"
      fetchItems={async () => {
        const data = await fetchCrmProdutos()
        return data.map(p => ({
          id: p.prod_id,
          codigo: p.codigo_prod ?? null,
          situacao: p.situacao_prod ?? true,
          descricao: p.descricao_prod,
          unidade: p.unidade_prod ?? null,
          ncmCodigo: p.ncm_codigo ?? null,
          localEstoque: p.local_estoque ?? 'PADRAO',
          preco: p.produto_valor ?? 0
        }))
      }}
      createItem={async payload => {
        await createCrmProduto({
          integ_id: null,
          situacao_prod: payload.situacao,
          descricao_prod: payload.descricao,
          unidade_prod: payload.unidade ?? null,
          ncm_codigo: payload.ncmCodigo ?? null,
          local_estoque: payload.localEstoque ?? 'PADRAO',
          obs_prod: null,
          produto_valor: payload.preco ?? 0
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmProduto(id, {
          integ_id: null,
          situacao_prod: payload.situacao,
          descricao_prod: payload.descricao,
          unidade_prod: payload.unidade ?? null,
          ncm_codigo: payload.ncmCodigo ?? null,
          local_estoque: payload.localEstoque ?? 'PADRAO',
          obs_prod: null,
          produto_valor: payload.preco ?? 0
        })
      }}
      deleteItem={async id => {
        await deleteCrmProduto(id)
      }}
    />
  )
}
