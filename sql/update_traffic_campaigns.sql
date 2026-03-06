-- Atualização da tabela traffic_campaigns para suportar criação de campanhas
CREATE TABLE IF NOT EXISTS public.traffic_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    
    nome TEXT NOT NULL,
    plataforma TEXT NOT NULL, -- facebook, google, tiktok, linkedin
    objetivo TEXT, -- traffic, conversion, leads, etc
    status TEXT DEFAULT 'rascunho', -- rascunho, ativa, pausada, concluida
    
    orcamento_tipo TEXT DEFAULT 'daily', -- daily, lifetime
    orcamento_valor NUMERIC(10, 2) DEFAULT 0,
    
    data_inicio DATE,
    data_fim DATE,
    
    publico_alvo TEXT,
    
    -- Dados do Criativo
    criativo_titulo TEXT,
    criativo_texto TEXT,
    criativo_cta TEXT,
    criativo_link_drive TEXT,
    criativo_arquivo_path TEXT, -- Para upload futuro (Bucket Storage)
    
    -- Métricas (já existentes na visualização, mas garantindo aqui)
    spend NUMERIC(10, 2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0
);

-- Habilitar RLS
ALTER TABLE public.traffic_campaigns ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Permitir acesso total a usuarios autenticados" ON public.traffic_campaigns
    FOR ALL USING (auth.role() = 'authenticated');
