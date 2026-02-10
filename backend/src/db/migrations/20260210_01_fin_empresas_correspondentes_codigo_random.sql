BEGIN;

DO $$
BEGIN
  IF to_regclass('public.fin_empresas_correspondentes') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.fin_empresas_correspondentes
    ALTER COLUMN codigo SET DEFAULT ('EC_' || upper(left(replace(gen_random_uuid()::text, '-', ''), 10)));

  UPDATE public.fin_empresas_correspondentes
     SET codigo = ('EC_' || upper(left(replace(gen_random_uuid()::text, '-', ''), 10)))
   WHERE codigo IS NULL OR btrim(codigo) = '' OR codigo IN ('Apliflow', 'Automaflow', 'Laboratorio', 'Tecnotron');

  ALTER TABLE public.fin_empresas_correspondentes
    ALTER COLUMN codigo SET NOT NULL;
END $$;

COMMIT;
