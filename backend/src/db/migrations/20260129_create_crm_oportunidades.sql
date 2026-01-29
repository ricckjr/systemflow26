-- Migration: Create CRM Oportunidades Table
-- Description: Creates the table for CRM opportunities with support for Kanban stages

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create crm_oportunidades table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.crm_oportunidades (
    id_oportunidade UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cod_oportunidade TEXT, -- Optional code/identifier
    cliente TEXT,
    nome_contato TEXT,
    telefone01_contato TEXT,
    telefone02_contato TEXT,
    email TEXT,
    id_vendedor UUID REFERENCES auth.users(id),
    vendedor TEXT, -- Denormalized name for easier access or specific name
    solucao TEXT,
    origem TEXT,
    id_motiv UUID REFERENCES public.crm_motivos(id_motiv),
    id_orig UUID REFERENCES public.crm_origem_leads(id_orig),
    id_prod UUID REFERENCES public.crm_produtos(id_prod),
    id_serv UUID REFERENCES public.crm_servicos(id_serv),
    id_vert UUID REFERENCES public.crm_verticais(id_vert),
    etapa TEXT NOT NULL DEFAULT 'Lead', -- Lead, Prospecção, Apresentação, Qualificação, Negociação, Conquistado, Perdidos, Pós-Venda
    status TEXT DEFAULT 'ABERTO', -- ABERTO, GANHO, PERDIDO, etc.
    temperatura INTEGER DEFAULT 0,
    valor_proposta NUMERIC(15, 2) DEFAULT 0,
    descricao_oportunidade TEXT,
    observacoes_vendedor TEXT,
    empresa_correspondente TEXT,
    data_inclusao TIMESTAMPTZ DEFAULT NOW(),
    data DATE DEFAULT CURRENT_DATE,
    dias_abertos INTEGER DEFAULT 0,
    dias_parado INTEGER DEFAULT 0,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    system_nota TEXT,
    priority TEXT DEFAULT 'medium' -- low, medium, high
);

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS id_motiv UUID,
  ADD COLUMN IF NOT EXISTS id_orig UUID,
  ADD COLUMN IF NOT EXISTS id_prod UUID,
  ADD COLUMN IF NOT EXISTS id_serv UUID,
  ADD COLUMN IF NOT EXISTS id_vert UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_oportunidades'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'crm_oportunidades_id_motiv_fkey'
  ) THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT crm_oportunidades_id_motiv_fkey FOREIGN KEY (id_motiv) REFERENCES public.crm_motivos(id_motiv);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_oportunidades'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'crm_oportunidades_id_orig_fkey'
  ) THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT crm_oportunidades_id_orig_fkey FOREIGN KEY (id_orig) REFERENCES public.crm_origem_leads(id_orig);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_oportunidades'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'crm_oportunidades_id_prod_fkey'
  ) THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT crm_oportunidades_id_prod_fkey FOREIGN KEY (id_prod) REFERENCES public.crm_produtos(id_prod);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_oportunidades'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'crm_oportunidades_id_serv_fkey'
  ) THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT crm_oportunidades_id_serv_fkey FOREIGN KEY (id_serv) REFERENCES public.crm_servicos(id_serv);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_oportunidades'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'crm_oportunidades_id_vert_fkey'
  ) THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT crm_oportunidades_id_vert_fkey FOREIGN KEY (id_vert) REFERENCES public.crm_verticais(id_vert);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'crm_oportunidades'
      AND c.conname = 'crm_oportunidades_etapa_check'
  ) THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT crm_oportunidades_etapa_check CHECK (
        etapa IN ('Lead', 'Prospecção', 'Apresentação', 'Qualificação', 'Negociação', 'Conquistado', 'Perdidos', 'Pós-Venda')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'crm_oportunidades'
      AND c.conname = 'crm_oportunidades_priority_check'
  ) THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT crm_oportunidades_priority_check CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END $$;

-- Add RLS policies
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidades' AND policyname = 'crm_oportunidades_select_auth'
  ) THEN
    CREATE POLICY crm_oportunidades_select_auth ON public.crm_oportunidades FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidades' AND policyname = 'crm_oportunidades_all_auth'
  ) THEN
    CREATE POLICY crm_oportunidades_all_auth ON public.crm_oportunidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_etapa ON public.crm_oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_vendedor ON public.crm_oportunidades(id_vendedor);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_motiv ON public.crm_oportunidades(id_motiv);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_orig ON public.crm_oportunidades(id_orig);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_prod ON public.crm_oportunidades(id_prod);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_serv ON public.crm_oportunidades(id_serv);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_vert ON public.crm_oportunidades(id_vert);

COMMIT;
