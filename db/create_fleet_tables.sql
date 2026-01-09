-- Tabela de Veículos
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo TEXT NOT NULL,
  placa TEXT NOT NULL UNIQUE,
  ano INTEGER,
  cor TEXT,
  km_atual INTEGER DEFAULT 0,
  status TEXT DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_uso', 'manutencao')),
  imagem_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela de Diário de Bordo (Uso do Veículo)
CREATE TABLE IF NOT EXISTS fleet_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id),
  user_id UUID NOT NULL REFERENCES auth.users(id), -- Quem pegou o carro
  data_saida TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  data_retorno TIMESTAMP WITH TIME ZONE,
  km_saida INTEGER NOT NULL,
  km_retorno INTEGER,
  destino TEXT,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Simplificadas para teste, ajustar para prod)
CREATE POLICY "Todos podem ver veiculos" ON fleet_vehicles FOR SELECT USING (true);
CREATE POLICY "Todos podem ver logs" ON fleet_logs FOR SELECT USING (true);

CREATE POLICY "Auth users insert veiculos" ON fleet_vehicles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users update veiculos" ON fleet_vehicles FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users insert logs" ON fleet_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users update logs" ON fleet_logs FOR UPDATE USING (auth.role() = 'authenticated');
