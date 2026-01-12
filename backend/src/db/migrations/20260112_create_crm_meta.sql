-- Migration: Create crm_meta_comercial table
-- Created at: 2026-01-12

CREATE TABLE IF NOT EXISTS public.crm_meta_comercial ( 
   id bigserial not null, 
   meta_valor_financeiro numeric(14, 2) not null default 0, 
   supermeta_valor_financeiro numeric(14, 2) not null default 0, 
   meta_novas_oportunidades integer not null default 0, 
   meta_ligacoes integer not null default 0, 
   tempo_ligacoes numeric null, 
   meta_comercial text null, 
   constraint crm_meta_comercial_pkey primary key (id) 
) TABLESPACE pg_default;

-- Insert default row if not exists
INSERT INTO public.crm_meta_comercial (id, meta_comercial, meta_novas_oportunidades, meta_valor_financeiro)
SELECT 1, 'Meta Mensal', 10, 10000
WHERE NOT EXISTS (SELECT 1 FROM public.crm_meta_comercial WHERE id = 1);
