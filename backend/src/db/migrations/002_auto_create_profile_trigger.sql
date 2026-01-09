-- Trigger: Handle New User (Auth -> Profile)
-- Description: Automatically creates a public.profiles record when a new user is created in auth.users

-- 1. Create the Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email_login, email_corporativo, cargo, ativo)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', 'Novo Usuário'),
    new.email,
    new.email, -- Default corporate email to login email initially
    COALESCE((new.raw_user_meta_data->>'cargo')::public.cargo_enum, 'VENDEDOR'),
    true
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if manually created
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
