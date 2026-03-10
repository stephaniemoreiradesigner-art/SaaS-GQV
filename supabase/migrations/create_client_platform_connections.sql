DROP TABLE IF EXISTS public.client_platform_connections CASCADE;

CREATE TABLE public.client_platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id bigint,
  client_id bigint NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_account_id text,
  external_business_id text,
  manager_account_id text,
  organization_id text,
  scopes text[] DEFAULT '{}'::text[],
  connection_status text NOT NULL DEFAULT 'disconnected',
  last_sync_at timestamptz,
  metadata jsonb,
  secret_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, platform)
);

CREATE INDEX client_platform_connections_client_id_idx ON public.client_platform_connections (client_id);
CREATE INDEX client_platform_connections_platform_idx ON public.client_platform_connections (platform);
CREATE INDEX client_platform_connections_status_idx ON public.client_platform_connections (connection_status);
CREATE INDEX client_platform_connections_tenant_id_idx ON public.client_platform_connections (tenant_id);

ALTER TABLE public.client_platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage platform connections" ON public.client_platform_connections;

CREATE POLICY "Authenticated manage platform connections"
ON public.client_platform_connections
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
