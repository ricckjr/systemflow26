
-- Tabela para logs e controle de tokens de redefinição
-- Nota: Em ambiente Supabase Hosted, idealmente ficaria no schema auth, mas para acesso via API Client usamos public com RLS
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON public.password_reset_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token_hash);

-- RLS: Apenas service_role pode inserir/ler (via Edge Functions ou Backend)
-- Usuários anônimos NÃO devem ler essa tabela diretamente
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Bloquear tudo por padrão (Security by Default)
-- A aplicação usará uma função RPC ou Service Role para interagir com isso
CREATE POLICY "Deny all access" ON public.password_reset_tokens FOR ALL USING (false);

-- Função para registrar tentativa de reset (Rate Limiting check)
CREATE OR REPLACE FUNCTION public.request_password_reset(
  p_email TEXT,
  p_ip TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Roda como admin para checar tabela protegida
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Rate Limit: Max 3 tentativas por hora por email
  SELECT COUNT(*) INTO v_count
  FROM public.password_reset_tokens
  WHERE user_email = p_email
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Muitas tentativas. Tente novamente em 1 hora.');
  END IF;

  -- Registrar tentativa (o token real é gerado pelo Supabase Auth, aqui guardamos log/hash para auditoria)
  INSERT INTO public.password_reset_tokens (user_email, token_hash, expires_at, ip_address)
  VALUES (p_email, 'managed_by_auth_service', NOW() + INTERVAL '1 hour', p_ip);

  RETURN jsonb_build_object('success', true);
END;
$$;
