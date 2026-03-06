-- ==============================================================================
-- MÓDULO TRÁFEGO PAGO - PERFORMANCE (VibeCode)
-- ==============================================================================

-- 1. Tabela de Campanhas
CREATE TABLE IF NOT EXISTS public.traffic_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    plataforma TEXT NOT NULL CHECK (plataforma IN ('facebook', 'google', 'tiktok', 'linkedin', 'pinterest')),
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'arquivada')),
    orcamento_diario DECIMAL(10,2) DEFAULT 0,
    objetivo TEXT, -- 'trafego', 'conversao', 'alcance'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Métricas Diárias (Para gráficos e KPIs)
CREATE TABLE IF NOT EXISTS public.traffic_metrics (
	id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
	campaign_id UUID REFERENCES public.traffic_campaigns(id) ON DELETE CASCADE,
	cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,
	ad_id TEXT,
	ad_name TEXT,
	adset_id TEXT,
	adset_name TEXT,
	data_metric TEXT NOT NULL,
	data_metric_fim TEXT,
	impressoes TEXT,
	clicks TEXT,
	custo TEXT,
	conversoes TEXT,
	valor_vendas TEXT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Performance de Criativos (Vinculado à solicitação original ou avulso)
-- Isso permite saber qual criativo da "aba criativos" performou melhor
CREATE TABLE IF NOT EXISTS public.ad_creative_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creative_id UUID REFERENCES public.ad_creatives(id) ON DELETE SET NULL, -- Pode ser null se for um anuncio criado direto na plataforma
    campaign_id UUID REFERENCES public.traffic_campaigns(id) ON DELETE CASCADE,
    nome_anuncio TEXT NOT NULL, -- Nome no Gerenciador
    imagem_url TEXT, -- Caso não venha do ad_creatives
    status TEXT DEFAULT 'ativo', -- ativo, pausado
    custo DECIMAL(10,2) DEFAULT 0,
    conversoes INT DEFAULT 0,
    ctr DECIMAL(5,2) DEFAULT 0,
    data_analise DATE DEFAULT CURRENT_DATE, -- Data da coleta dos dados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Segurança)
ALTER TABLE public.traffic_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_creative_performance ENABLE ROW LEVEL SECURITY;

-- Políticas (Simplificadas para MVP: Authenticated vê tudo, depois refinamos por time)
CREATE POLICY "Authenticated users can manage campaigns" ON public.traffic_campaigns FOR ALL USING (public.is_tenant_match(cliente_id)) WITH CHECK (public.is_tenant_match(cliente_id));
CREATE POLICY "Authenticated users can manage metrics" ON public.traffic_metrics FOR ALL USING (public.is_tenant_match(cliente_id));
CREATE POLICY "Authenticated users can manage creative perf" ON public.ad_creative_performance FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.traffic_campaigns tc
        WHERE tc.id = ad_creative_performance.campaign_id
        AND public.is_tenant_match(tc.cliente_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.traffic_campaigns tc
        WHERE tc.id = ad_creative_performance.campaign_id
        AND public.is_tenant_match(tc.cliente_id)
    )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_traffic_campaigns_modtime
    BEFORE UPDATE ON public.traffic_campaigns
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
