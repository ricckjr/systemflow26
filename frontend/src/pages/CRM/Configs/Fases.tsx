import React from 'react'
import { OrderedColorCrudPage } from './OrderedColorCrudPage'
import { createCrmFase, deleteCrmFase, fetchCrmFases, updateCrmFase } from '@/services/crm'

export default function Fases() {
  return (
    <OrderedColorCrudPage
      title="Fase CRM"
      subtitle="Configuração das fases (colunas) do Kanban de propostas comerciais."
      singularLabel="Fase"
      fetchItems={async () => {
        const data = await fetchCrmFases()
        return data.map((f) => ({
          id: f.fase_id,
          descricao: f.fase_desc,
          obs: f.fase_obs,
          ordem: f.fase_ordem ?? 0,
          cor: f.fase_cor
        }))
      }}
      createItem={async (payload) => {
        await createCrmFase({
          integ_id: null,
          fase_desc: payload.descricao,
          fase_obs: payload.obs,
          fase_ordem: payload.ordem,
          fase_cor: payload.cor
        })
      }}
      updateItem={async (id, payload) => {
        await updateCrmFase(id, {
          integ_id: null,
          fase_desc: payload.descricao,
          fase_obs: payload.obs,
          fase_ordem: payload.ordem,
          fase_cor: payload.cor
        })
      }}
      deleteItem={async (id) => {
        await deleteCrmFase(id)
      }}
    />
  )
}
