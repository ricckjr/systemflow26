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
          preco: s.valor_serv ?? 0,
          categoria: s.categ_serv ?? 'Clientes - Serviços Prestados',
          codNbs: s.cod_nbs ?? null,
          codLc116: s.cod_lc116 ?? null,
          descricaoDetalhada: s.descricao_detalhada ?? null
        }))
      }}
      createItem={async (payload) => {
        await createCrmServico({
          integ_id: null,
          situacao_serv: payload.situacao,
          descricao_serv: payload.descricao,
          valor_serv: payload.preco ?? 0,
          categ_serv: payload.categoria ?? 'Clientes - Serviços Prestados',
          cod_nbs: payload.codNbs ?? null,
          cod_lc116: payload.codLc116 ?? null,
          descricao_detalhada: payload.descricaoDetalhada ?? null
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmServico(id, {
          integ_id: null,
          situacao_serv: payload.situacao,
          descricao_serv: payload.descricao,
          valor_serv: payload.preco ?? 0,
          categ_serv: payload.categoria ?? 'Clientes - Serviços Prestados',
          cod_nbs: payload.codNbs ?? null,
          cod_lc116: payload.codLc116 ?? null,
          descricao_detalhada: payload.descricaoDetalhada ?? null
        })
      }}
      deleteItem={async (id) => {
        await deleteCrmServico(id)
      }}
    />
  )
}
