-- Tabela de Workflows (Fluxos)
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id BIGINT REFERENCES public.clientes(id), -- Identificador do Cliente/Tenant
    responsible_id UUID REFERENCES public.colaboradores(id), -- Colaborador responsável
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active', -- active, paused, error
    environment TEXT DEFAULT 'production', -- production, staging
    trigger_type TEXT, -- webhook, schedule, event
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Versões (Backups/Snapshots)
CREATE TABLE IF NOT EXISTS public.workflow_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    tenant_id BIGINT REFERENCES public.clientes(id),
    version_number INT NOT NULL,
    definition_json JSONB, -- O JSON do fluxo (n8n, make, etc)
    created_by TEXT, -- Email ou ID do usuário
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Deployments (Qual versão está rodando)
CREATE TABLE IF NOT EXISTS public.workflow_deployments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    version_id UUID REFERENCES public.workflow_versions(id),
    tenant_id BIGINT REFERENCES public.clientes(id),
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_by TEXT,
    status TEXT DEFAULT 'active' -- active, rolled_back
);

-- Tabela de Execuções (Logs de execução para monitoramento)
CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    tenant_id BIGINT REFERENCES public.clientes(id),
    status TEXT, -- success, error
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_ms INT,
    error_message TEXT
);

-- Tabela de Failover/Standby (Alta Disponibilidade)
CREATE TABLE IF NOT EXISTS public.workflow_failover_pairs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id BIGINT REFERENCES public.clientes(id),
    primary_workflow_id UUID REFERENCES public.workflows(id),
    standby_workflow_id UUID REFERENCES public.workflows(id),
    error_threshold INT DEFAULT 3, -- Quantos erros antes de ativar standby
    window_minutes INT DEFAULT 5, -- Em quanto tempo (ex: 3 erros em 5 min)
    auto_failover BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'healthy', -- healthy, failover_triggered
    last_check_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Audit Logs (Rastreabilidade)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id BIGINT REFERENCES public.clientes(id),
    user_id TEXT, -- Pode ser UUID ou Email
    action_type TEXT, -- create, update, delete, deploy, rollback, failover
    resource_type TEXT, -- workflow, version, settings
    resource_id UUID,
    details_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Segurança)
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_failover_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Simplificadas para 'authenticated')
-- Em produção real, você filtraria por tenant_id usando auth.uid() ou metadata

DROP POLICY IF EXISTS "Authenticated users can manage workflows" ON public.workflows;
CREATE POLICY "Authenticated users can manage workflows" ON public.workflows FOR ALL USING (public.is_tenant_match(tenant_id));

DROP POLICY IF EXISTS "Authenticated users can manage versions" ON public.workflow_versions;
CREATE POLICY "Authenticated users can manage versions" ON public.workflow_versions FOR ALL USING (public.is_tenant_match(tenant_id));

DROP POLICY IF EXISTS "Authenticated users can manage deployments" ON public.workflow_deployments;
CREATE POLICY "Authenticated users can manage deployments" ON public.workflow_deployments FOR ALL USING (public.is_tenant_match(tenant_id));

DROP POLICY IF EXISTS "Authenticated users can manage executions" ON public.workflow_executions;
CREATE POLICY "Authenticated users can manage executions" ON public.workflow_executions FOR ALL USING (public.is_tenant_match(tenant_id));

DROP POLICY IF EXISTS "Authenticated users can manage failover" ON public.workflow_failover_pairs;
CREATE POLICY "Authenticated users can manage failover" ON public.workflow_failover_pairs FOR ALL USING (public.is_tenant_match(tenant_id));

DROP POLICY IF EXISTS "Authenticated users can manage audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can manage audit_logs" ON public.audit_logs FOR ALL USING (public.is_tenant_match(tenant_id));
