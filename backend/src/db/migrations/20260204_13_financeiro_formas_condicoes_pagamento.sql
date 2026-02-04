BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.fin_formas_pagamento (
  forma_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fin_condicoes_pagamento (
  condicao_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  descricao text NOT NULL,
  parcelas_dias integer[] NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_formas_pagamento_codigo ON public.fin_formas_pagamento (codigo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_condicoes_pagamento_codigo ON public.fin_condicoes_pagamento (codigo);

ALTER TABLE public.fin_formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_condicoes_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_formas_pagamento_select_auth ON public.fin_formas_pagamento;
DROP POLICY IF EXISTS fin_formas_pagamento_write_fin_control ON public.fin_formas_pagamento;
DROP POLICY IF EXISTS fin_condicoes_pagamento_select_auth ON public.fin_condicoes_pagamento;
DROP POLICY IF EXISTS fin_condicoes_pagamento_write_fin_control ON public.fin_condicoes_pagamento;

CREATE POLICY fin_formas_pagamento_select_auth
  ON public.fin_formas_pagamento
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY fin_formas_pagamento_write_fin_control
  ON public.fin_formas_pagamento
  FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'))
  WITH CHECK (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'));

CREATE POLICY fin_condicoes_pagamento_select_auth
  ON public.fin_condicoes_pagamento
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY fin_condicoes_pagamento_write_fin_control
  ON public.fin_condicoes_pagamento
  FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'))
  WITH CHECK (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'));

INSERT INTO public.fin_formas_pagamento (codigo, descricao)
VALUES
  ('PIX', 'PIX'),
  ('BOLETO', 'Boleto'),
  ('AVISTA', 'À vista'),
  ('CREDITO_1', 'Crédito x1'),
  ('CREDITO_2', 'Crédito x2'),
  ('CREDITO_3', 'Crédito x3'),
  ('CREDITO_4', 'Crédito x4'),
  ('CREDITO_5', 'Crédito x5'),
  ('CREDITO_6', 'Crédito x6'),
  ('TRANSFERENCIA_BANCARIA', 'Transferência Bancária'),
  ('DEPOSITO_BANCARIO', 'Depósito Bancário'),
  ('DINHEIRO', 'Dinheiro')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.fin_condicoes_pagamento (codigo, descricao, parcelas_dias)
VALUES
  ('D30', '30 dias', ARRAY[30]),
  ('D60', '60 dias', ARRAY[60]),
  ('D90', '90 dias', ARRAY[90]),
  ('D30_60', '30 / 60', ARRAY[30,60]),
  ('D30_60_90', '30 / 60 / 90', ARRAY[30,60,90]),
  ('ENTRADA_30', 'Entrada + 30 dias', ARRAY[0,30])
ON CONFLICT (codigo) DO NOTHING;

COMMIT;

