-- FIX: Criar tabela de relatórios de tráfego (traffic_reports_data) e corrigir permissões

-- 1. Criar a tabela se não existir
CREATE TABLE IF NOT EXISTS public.traffic_reports_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id bigint REFERENCES public.clientes(id) ON DELETE CASCADE,
    date date NOT NULL,
    
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

-- 2. Habilitar RLS
ALTER TABLE public.traffic_reports_data ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de acesso (Leitura pública ou autenticada para simplificar dashboard)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.traffic_reports_data;
CREATE POLICY "Enable read access for all users" ON public.traffic_reports_data FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.traffic_reports_data;
CREATE POLICY "Enable insert for authenticated users only" ON public.traffic_reports_data FOR INSERT TO authenticated WITH CHECK (public.is_tenant_match(cliente_id));

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.traffic_reports_data;
CREATE POLICY "Enable update for authenticated users only" ON public.traffic_reports_data FOR UPDATE TO authenticated USING (public.is_tenant_match(cliente_id));

-- 4. Garantir permissões de Grant
GRANT ALL ON TABLE public.traffic_reports_data TO authenticated, service_role;
