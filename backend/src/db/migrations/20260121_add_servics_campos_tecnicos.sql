BEGIN;

ALTER TABLE IF EXISTS public.servics_equipamento
  ADD COLUMN IF NOT EXISTS testes_realizados text;

ALTER TABLE IF EXISTS public.servics_equipamento
  ADD COLUMN IF NOT EXISTS servicos_a_fazer text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'servics_equipamento'
      AND column_name = 'relatorio_tecnico'
  ) THEN
    EXECUTE $migrate$
      UPDATE public.servics_equipamento
      SET testes_realizados = relatorio_tecnico
      WHERE testes_realizados IS NULL
        AND relatorio_tecnico IS NOT NULL
        AND btrim(relatorio_tecnico) <> '';
    $migrate$;
  END IF;
END $$;

COMMIT;

