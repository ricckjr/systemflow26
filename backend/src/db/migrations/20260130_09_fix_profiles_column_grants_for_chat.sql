BEGIN;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ',')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name IN (
      'id',
      'nome',
      'avatar_url',
      'cargo',
      'created_at',
      'updated_at',
      'email_login',
      'email_corporativo',
      'telefone',
      'ramal',
      'ativo',
      'status',
      'last_seen'
    );

  IF cols IS NULL OR btrim(cols) = '' THEN
    RETURN;
  END IF;

  EXECUTE format('GRANT SELECT (%s) ON TABLE public.profiles TO authenticated', cols);
END;
$$;

COMMIT;

