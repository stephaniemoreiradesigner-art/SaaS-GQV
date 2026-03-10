CREATE TABLE IF NOT EXISTS public.client_platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    external_account_id TEXT,
    external_business_id TEXT,
    manager_account_id TEXT,
    organization_id TEXT,
    scopes TEXT[] DEFAULT '{}'::TEXT[],
    connection_status TEXT NOT NULL DEFAULT 'disconnected',
    last_sync_at TIMESTAMPTZ,
    metadata JSONB,
    secret_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cliente_id, platform)
);

CREATE INDEX IF NOT EXISTS client_platform_connections_cliente_id_idx ON public.client_platform_connections (cliente_id);
CREATE INDEX IF NOT EXISTS client_platform_connections_platform_idx ON public.client_platform_connections (platform);
CREATE INDEX IF NOT EXISTS client_platform_connections_status_idx ON public.client_platform_connections (connection_status);
CREATE INDEX IF NOT EXISTS client_platform_connections_tenant_id_idx ON public.client_platform_connections (tenant_id);

ALTER TABLE public.client_platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency users manage platform connections" ON public.client_platform_connections;

CREATE POLICY "Agency users manage platform connections"
ON public.client_platform_connections
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.colaboradores 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.colaboradores 
    WHERE user_id = auth.uid()
  )
);

