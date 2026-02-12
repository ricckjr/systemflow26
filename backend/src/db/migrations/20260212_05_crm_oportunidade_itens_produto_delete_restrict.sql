BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidade_itens') IS NULL OR to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidade_itens
    DROP CONSTRAINT IF EXISTS fk_crm_oportunidade_itens_produto;

  ALTER TABLE public.crm_oportunidade_itens
    ADD CONSTRAINT fk_crm_oportunidade_itens_produto
    FOREIGN KEY (produto_id) REFERENCES public.crm_produtos(prod_id) ON DELETE RESTRICT;
END $$;

COMMIT;

