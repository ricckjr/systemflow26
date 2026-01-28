CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  system_in_app_enabled boolean NOT NULL DEFAULT true,
  system_sound_enabled boolean NOT NULL DEFAULT true,
  system_native_enabled boolean NOT NULL DEFAULT false,
  system_push_enabled boolean NOT NULL DEFAULT false,

  chat_in_app_enabled boolean NOT NULL DEFAULT true,
  chat_sound_enabled boolean NOT NULL DEFAULT true,
  chat_native_enabled boolean NOT NULL DEFAULT false,
  chat_push_enabled boolean NOT NULL DEFAULT false,

  permission_prompt_dismissed_until timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'notification_preferences_select'
  ) THEN
    CREATE POLICY notification_preferences_select
      ON public.notification_preferences
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'notification_preferences_insert'
  ) THEN
    CREATE POLICY notification_preferences_insert
      ON public.notification_preferences
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'notification_preferences_update'
  ) THEN
    CREATE POLICY notification_preferences_update
      ON public.notification_preferences
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS notification_preferences_set_updated_at ON public.notification_preferences;
    CREATE TRIGGER notification_preferences_set_updated_at
      BEFORE UPDATE ON public.notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

