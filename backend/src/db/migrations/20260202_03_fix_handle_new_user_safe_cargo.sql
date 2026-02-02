CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_cargo text;
  safe_cargo public.cargo_enum;
BEGIN
  requested_cargo := new.raw_user_meta_data->>'cargo';

  SELECT e.enumlabel::public.cargo_enum
    INTO safe_cargo
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname = 'cargo_enum'
    AND e.enumlabel = requested_cargo
  LIMIT 1;

  IF safe_cargo IS NULL THEN
    safe_cargo := 'VENDEDOR'::public.cargo_enum;
  END IF;

  INSERT INTO public.profiles (id, nome, email_login, email_corporativo, cargo, ativo)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', 'Novo Usuário'),
    new.email,
    new.email,
    safe_cargo,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
