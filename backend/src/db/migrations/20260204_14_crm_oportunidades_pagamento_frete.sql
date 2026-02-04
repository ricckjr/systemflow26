BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS condicao_pagamento_id uuid;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS tipo_frete text;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_tipo_frete;

  ALTER TABLE public.crm_oportunidades
    ADD CONSTRAINT chk_crm_oportunidades_tipo_frete
    CHECK (tipo_frete IS NULL OR tipo_frete IN ('FOB', 'CIF'));

  IF to_regclass('public.fin_formas_pagamento') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_forma_pagamento;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_forma_pagamento
      FOREIGN KEY (forma_pagamento_id)
      REFERENCES public.fin_formas_pagamento(forma_id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.fin_condicoes_pagamento') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_condicao_pagamento;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_condicao_pagamento
      FOREIGN KEY (condicao_pagamento_id)
      REFERENCES public.fin_condicoes_pagamento(condicao_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_forma_pagamento_id
  ON public.crm_oportunidades (forma_pagamento_id);

CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_condicao_pagamento_id
  ON public.crm_oportunidades (condicao_pagamento_id);

CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_tipo_frete
  ON public.crm_oportunidades (tipo_frete);

COMMIT;

