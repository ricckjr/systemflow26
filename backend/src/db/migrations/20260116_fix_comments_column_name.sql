BEGIN;

-- Script para corrigir a tabela taskflow_comments
-- O código espera 'user_id', mas o banco parece ter 'created_by'

DO $$
BEGIN
    -- 1. Verifica se a coluna 'created_by' existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'taskflow_comments' AND column_name = 'created_by') THEN
        
        -- Verifica se 'user_id' TAMBÉM existe
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'taskflow_comments' AND column_name = 'user_id') THEN
            -- Se ambas existem, migra dados e remove created_by
            UPDATE public.taskflow_comments SET user_id = created_by WHERE user_id IS NULL;
            ALTER TABLE public.taskflow_comments DROP COLUMN created_by;
        ELSE
            -- Se apenas created_by existe, renomeia para user_id
            ALTER TABLE public.taskflow_comments RENAME COLUMN created_by TO user_id;
        END IF;

    END IF;

    -- 2. Garante que 'user_id' existe e é NOT NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'taskflow_comments' AND column_name = 'user_id') THEN
        ALTER TABLE public.taskflow_comments ALTER COLUMN user_id SET NOT NULL;
    END IF;

END $$;

COMMIT;
