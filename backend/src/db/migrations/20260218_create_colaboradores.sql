
-- Create Colaboradores table
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.fin_empresas_correspondentes(empresa_id),
  
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  data_nascimento date NOT NULL,
  email_pessoal text NOT NULL,
  telefone text NOT NULL,
  endereco_completo text NOT NULL,
  cep text NOT NULL,
  
  matricula text NOT NULL,
  departamento text NOT NULL,
  data_admissao date NOT NULL,
  email_corporativo text,
  ramal text,
  data_demissao date,
  obs_demissao text,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT colaboradores_user_id_key UNIQUE (user_id),
  CONSTRAINT colaboradores_cpf_key UNIQUE (cpf),
  CONSTRAINT colaboradores_matricula_key UNIQUE (matricula, empresa_id)
);

-- Enable RLS for Colaboradores
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.colaboradores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.colaboradores
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.colaboradores
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.colaboradores
  FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_colaboradores_updated ON public.colaboradores;
CREATE TRIGGER on_colaboradores_updated
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create Colaboradores Documentos table
CREATE TABLE IF NOT EXISTS public.colaboradores_documentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  nome text NOT NULL,
  arquivo_nome text,
  arquivo_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for Documentos
ALTER TABLE public.colaboradores_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.colaboradores_documentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.colaboradores_documentos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON public.colaboradores_documentos
  FOR DELETE TO authenticated USING (true);
