CREATE TABLE IF NOT EXISTS public.traffic_client_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    plataforma TEXT CHECK (plataforma IN ('facebook', 'google', 'tiktok', 'linkedin', 'outra')),
    conta_id TEXT,
    pixel_id TEXT,
    link_acesso TEXT,
    login TEXT,
    senha TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE
);

-- Habilitar RLS (Row Level Security) se necessário futuramente
ALTER TABLE public.traffic_client_info ENABLE ROW LEVEL SECURITY;

-- Política simples (aberta para MVP, ajustar conforme auth)
CREATE POLICY "Acesso total" ON public.traffic_client_info
FOR ALL USING (true) WITH CHECK (true);