-- Fix Admin User Permissions
-- Description: Ensures the specified user has ADMIN role and is active in public.profiles.
-- REPLACE 'seu_email@aqui.com' with the actual admin email before running.

UPDATE public.profiles
SET 
  cargo = 'ADMIN',
  ativo = true
WHERE email_login = 'ricck.nascimento@hotmail.com'; -- Substitua pelo seu e-mail se diferente

-- Fallback: If profile doesn't exist, try to insert it from auth.users
INSERT INTO public.profiles (id, nome, email_login, cargo, ativo)
SELECT id, 'Admin User', email, 'ADMIN', true
FROM auth.users
WHERE email = 'ricck.nascimento@hotmail.com' -- Substitua pelo seu e-mail se diferente
ON CONFLICT (id) DO UPDATE
SET cargo = 'ADMIN', ativo = true;
