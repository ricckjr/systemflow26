-- Migration: Rename meta_comercial to meta_geral
-- Created at: 2026-01-12 15:30:00

DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name = 'crm_meta_comercial' AND column_name = 'meta_comercial') THEN
      ALTER TABLE public.crm_meta_comercial RENAME COLUMN meta_comercial TO meta_geral;
  END IF;
END $$;
