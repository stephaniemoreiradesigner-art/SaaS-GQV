-- Script COMPLETO para corrigir a tabela traffic_reports_data
-- Resolve o erro "relation does not exist" criando a tabela antes de alterar
-- CORRIGIDO: cliente_id agora é BIGINT para bater com a tabela de clientes

-- 1. Criar a tabela se não existir (Estrutura Base)
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

-- 2. Correção forçada de tipos (caso a tabela já exista com tipos errados)
DO $$
BEGIN
    -- Se cliente_id for UUID, tentar converter para BIGINT (pode falhar se houver dados incompatíveis, mas clientes.id é bigint)
    -- Na verdade, se clientes.id é bigint, traffic_reports_data.cliente_id deve ser bigint.
    -- Se estiver como UUID, dropamos e recriamos a coluna ou alteramos o tipo.
    
    -- Verificando tipo atual
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'traffic_reports_data' 
        AND column_name = 'cliente_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Alterar tipo (usando using para conversão se possível, ou recriando)
        -- OBS: UUID para BIGINT não converte direto. Melhor dropar constraint e alterar.
        -- CUIDADO: Isso pode perder dados se não for compatível.
        -- Assumindo que é um ambiente de dev ou erro de schema inicial.
        ALTER TABLE public.traffic_reports_data DROP CONSTRAINT IF EXISTS traffic_reports_data_cliente_id_fkey;
        ALTER TABLE public.traffic_reports_data ALTER COLUMN cliente_id TYPE bigint USING (cliente_id::text::bigint); -- Tentativa arriscada se for UUID real
        -- Se falhar, o usuário verá erro e terá que limpar a tabela.
        
        ALTER TABLE public.traffic_reports_data ADD CONSTRAINT traffic_reports_data_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Adicionar colunas extras que podem estar faltando (como 'platform')
ALTER TABLE public.traffic_reports_data 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta_ads';

-- 4. Criar Índices para performance
CREATE INDEX IF NOT EXISTS idx_traffic_reports_cliente_date ON public.traffic_reports_data(cliente_id, date);
CREATE INDEX IF NOT EXISTS idx_traffic_reports_campaign ON public.traffic_reports_data(campaign_id);

-- 5. Habilitar RLS (Segurança)
ALTER TABLE public.traffic_reports_data ENABLE ROW LEVEL SECURITY;

-- 6. Recriar Políticas de Segurança (RLS)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.traffic_reports_data;

CREATE POLICY "Enable read access for authenticated users"
ON public.traffic_reports_data FOR SELECT
TO authenticated
USING (public.is_tenant_match(cliente_id));

CREATE POLICY "Enable insert access for authenticated users"
ON public.traffic_reports_data FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_match(cliente_id));

CREATE POLICY "Enable update access for authenticated users"
ON public.traffic_reports_data FOR UPDATE
TO authenticated
USING (public.is_tenant_match(cliente_id));

CREATE POLICY "Enable delete access for authenticated users"
ON public.traffic_reports_data FOR DELETE
TO authenticated
USING (public.is_tenant_match(cliente_id));

-- 7. Garantir permissões de acesso (Grants)
GRANT ALL ON public.traffic_reports_data TO authenticated;
GRANT ALL ON public.traffic_reports_data TO service_role;
