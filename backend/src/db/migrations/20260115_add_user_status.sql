-- 1. Add Status Columns to Profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('online', 'busy', 'away', 'offline')) DEFAULT 'offline',
ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

-- 2. Create function to update heartbeat (optional, but good for manual status)
CREATE OR REPLACE FUNCTION public.update_user_status(new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    status = new_status,
    last_seen = now()
  WHERE id = auth.uid();
END;
$$;
