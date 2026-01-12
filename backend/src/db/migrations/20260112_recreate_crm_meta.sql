-- Migration: Recreate crm_meta_comercial table
-- Created at: 2026-01-12 15:00:00

DROP TABLE IF EXISTS public.crm_meta_comercial;

CREATE TABLE public.crm_meta_comercial ( 
   id bigserial not null, 
   meta_valor_financeiro numeric(14, 2) not null default 0, 
   supermeta_valor_financeiro numeric(14, 2) not null default 0, 
   meta_novas_oportunidades integer not null default 0, 
   meta_ligacoes integer not null default 0, 
   tempo_ligacoes numeric null, 
   meta_comercial text null, 
   constraint crm_meta_comercial_pkey primary key (id) 
) TABLESPACE pg_default;

-- Insert default row
INSERT INTO public.crm_meta_comercial (id, meta_comercial, meta_novas_oportunidades, meta_valor_financeiro, supermeta_valor_financeiro, meta_ligacoes)
VALUES (1, 'Meta Comercial', 10, 10000, 15000, 50);
