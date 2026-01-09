-- ============================================================
-- 🔐 TRIGGER: Criar perfil automaticamente ao criar Auth User
-- Garante 1:1 entre auth.users e public.profiles
-- Compatível com cargo_enum
-- ============================================================

-- Remove função antiga (se existir)
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Cria função
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    nome,
    email_login,
    cargo,
    ativo,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'VENDEDOR'::cargo_enum,  -- Cargo padrão seguro
    true,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Remove trigger antiga (se existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Cria trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
