BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.fin_empresas_correspondentes (
  empresa_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  inscricao_estadual text,
  inscricao_municipal text,
  endereco text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  telefone text,
  logo_path text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_empresas_correspondentes_codigo
  ON public.fin_empresas_correspondentes (codigo);

ALTER TABLE public.fin_empresas_correspondentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_empresas_correspondentes_select_auth ON public.fin_empresas_correspondentes;
DROP POLICY IF EXISTS fin_empresas_correspondentes_write_fin_control ON public.fin_empresas_correspondentes;

CREATE POLICY fin_empresas_correspondentes_select_auth
  ON public.fin_empresas_correspondentes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY fin_empresas_correspondentes_write_fin_control
  ON public.fin_empresas_correspondentes
  FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'))
  WITH CHECK (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'));

INSERT INTO public.fin_empresas_correspondentes (
  codigo,
  razao_social,
  nome_fantasia,
  cnpj,
  inscricao_estadual,
  endereco,
  cidade,
  uf,
  cep,
  telefone
)
VALUES
  (
    'Apliflow',
    'APLIFLOW EQUIPAMENTOS INDUSTRIAIS LTDA',
    'Apliflow',
    '22.202.421/0001-38',
    '002.537.835/0093',
    'RUA ARAPARI, 223',
    'BELO HORIZONTE',
    'MG',
    '31050-540',
    '(31) 3487-1600'
  ),
  ('Automaflow', NULL, 'Automaflow', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('Laboratorio', NULL, 'Laboratorio', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('Tecnotron', NULL, 'Tecnotron', NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
