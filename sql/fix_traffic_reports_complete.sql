-- SCRIPT COMPLETO DE CORREÇÃO (Rodar este resolve o erro "relation does not exist")

-- 1. Criar a tabela se não existir (COM a coluna platform já inclusa e tipo correto para cliente_id)
-- OBS: Se a tabela já existir com tipo errado, este comando não altera. 
-- Recomendado: Rodar DROP TABLE public.traffic_reports_data; se não tiver dados importantes.

CREATE TABLE IF NOT EXISTS public.traffic_reports_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id bigint REFERENCES public.clientes(id) ON DELETE CASCADE, -- Corrigido para bigint
    date date NOT NULL,
    platform text DEFAULT 'meta_ads',
    
    -- Identificação
    account_name text,
    campaign_id text,
    campaign_name text,
    adset_id text,
    adset_name text,
    ad_id text,
    ad_name text,
    
    -- Métricas Principais
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    spend numeric(10, 2) DEFAULT 0,
    ctr numeric(5, 2) DEFAULT 0,
    objective text,
    reach integer DEFAULT 0,
    frequency numeric(5, 2) DEFAULT 0,
    
    -- Conversões e Ações
    conversions integer DEFAULT 0,
    conversion_values numeric(10, 2) DEFAULT 0,
    cost_per_conversion numeric(10, 2) DEFAULT 0,
    product_views integer DEFAULT 0,
    actions integer DEFAULT 0,
    
    -- Outros Cliques
    cost_per_ad_click numeric(10, 2) DEFAULT 0,
    outbound_clicks integer DEFAULT 0,
    outbound_clicks_ctr numeric(5, 2) DEFAULT 0,
    
    -- Orçamento e Status
    daily_budget numeric(10, 2),
    lifetime_budget numeric(10, 2),
    status text,
    effective_status text,
    created_time timestamp with time zone,
    
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Se a tabela já existia sem a coluna platform, adiciona agora (Idempotência)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='traffic_reports_data' AND column_name='platform') THEN
        ALTER TABLE public.traffic_reports_data ADD COLUMN platform TEXT DEFAULT 'meta_ads';
    END IF;
END $$;

-- 3. Habilitar RLS (Segurança)
ALTER TABLE public.traffic_reports_data ENABLE ROW LEVEL SECURITY;

-- 4. Limpar políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Enable read access for all users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.traffic_reports_data;

-- 5. Criar novas políticas permissivas (para garantir que o sistema funcione)
CREATE POLICY "Enable read access for authenticated users"
ON public.traffic_reports_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON public.traffic_reports_data FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON public.traffic_reports_data FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete access for authenticated users"
ON public.traffic_reports_data FOR DELETE
TO authenticated
USING (true);

-- 6. Garantir permissões de acesso
GRANT ALL ON public.traffic_reports_data TO authenticated;
GRANT ALL ON public.traffic_reports_data TO service_role;
