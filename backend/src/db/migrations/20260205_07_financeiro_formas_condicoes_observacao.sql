BEGIN;

DO $$
BEGIN
  IF to_regclass('public.fin_formas_pagamento') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'fin_formas_pagamento'
        AND column_name = 'observacao'
    ) THEN
      ALTER TABLE public.fin_formas_pagamento ADD COLUMN observacao text;
    END IF;
  END IF;

  IF to_regclass('public.fin_condicoes_pagamento') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'fin_condicoes_pagamento'
        AND column_name = 'observacao'
    ) THEN
      ALTER TABLE public.fin_condicoes_pagamento ADD COLUMN observacao text;
    END IF;
  END IF;
END $$;

COMMIT;
