BEGIN;

DO $$
BEGIN
    -- 1. Garantir que a tabela existe (caso extremo)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        CREATE TABLE public.notifications (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            title text NOT NULL,
            content text,
            link text,
            type text NOT NULL,
            is_read boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        -- Habilitar RLS
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    ELSE
        -- 2. Adicionar colunas faltantes se a tabela já existir
        
        -- Coluna 'content'
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'content') THEN
            ALTER TABLE public.notifications ADD COLUMN content text;
        END IF;

        -- Coluna 'link'
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'link') THEN
            ALTER TABLE public.notifications ADD COLUMN link text;
        END IF;

        -- Coluna 'title'
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'title') THEN
             ALTER TABLE public.notifications ADD COLUMN title text DEFAULT 'Notificação';
             ALTER TABLE public.notifications ALTER COLUMN title DROP DEFAULT; -- Remove default após criar
        END IF;

         -- Coluna 'type'
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'type') THEN
             ALTER TABLE public.notifications ADD COLUMN type text DEFAULT 'system';
             ALTER TABLE public.notifications ALTER COLUMN type DROP DEFAULT;
        END IF;

        -- Coluna 'is_read'
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read') THEN
             ALTER TABLE public.notifications ADD COLUMN is_read boolean DEFAULT false;
        END IF;

    END IF;

    -- 3. Garantir Políticas de Segurança (RLS) básicas
    -- Usuário pode ver suas próprias notificações
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_select') THEN
        CREATE POLICY notifications_select ON public.notifications
        FOR SELECT USING (user_id = auth.uid());
    END IF;

    -- Usuário pode marcar como lida (update)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_update') THEN
        CREATE POLICY notifications_update ON public.notifications
        FOR UPDATE USING (user_id = auth.uid());
    END IF;

END $$;

COMMIT;
