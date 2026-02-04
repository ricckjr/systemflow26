BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos
    ALTER COLUMN local_estoque SET DEFAULT '03';

  UPDATE public.crm_produtos
     SET local_estoque = CASE
       WHEN local_estoque IN ('03', '04') THEN local_estoque
       WHEN local_estoque = 'INTERNO' THEN '04'
       WHEN local_estoque = 'PADRAO' THEN '03'
       WHEN local_estoque = '05' THEN '03'
       ELSE '03'
     END;

  ALTER TABLE public.crm_produtos
    DROP CONSTRAINT IF EXISTS crm_produtos_local_estoque_check;

  ALTER TABLE public.crm_produtos
    ADD CONSTRAINT crm_produtos_local_estoque_check CHECK (local_estoque IN ('03', '04'));
END $$;

COMMIT;
