BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.fin_empresas_correspondentes') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crm_oportunidades
     SET empresa_correspondente = 'Apliflow'
   WHERE empresa_correspondente IS NULL OR btrim(empresa_correspondente) = '';

  UPDATE public.crm_oportunidades
     SET empresa_correspondente =
       CASE upper(btrim(empresa_correspondente))
         WHEN 'APLIFLOW' THEN 'Apliflow'
         WHEN 'AUTOMAFLOW' THEN 'Automaflow'
         WHEN 'TECNOTRON' THEN 'Tecnotron'
         WHEN 'LABORATORIO' THEN 'Laboratorio'
         ELSE empresa_correspondente
       END;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_empresa_correspondente;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_empresa_correspondente;

  ALTER TABLE public.crm_oportunidades
    ADD CONSTRAINT fk_crm_oportunidades_empresa_correspondente
    FOREIGN KEY (empresa_correspondente)
    REFERENCES public.fin_empresas_correspondentes (codigo)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
END $$;

COMMIT;
