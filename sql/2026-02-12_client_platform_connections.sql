CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.clientes c
    JOIN public.times t ON t.id = c.time_id
    WHERE c.id = p_client_id
      AND t.tenant_id = public.current_tenant_id()
  );
$$;

CREATE TABLE IF NOT EXISTS public.client_platform_connections (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  external_id TEXT,
  external_name TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT client_platform_connections_platform_check CHECK (platform IN ('instagram','facebook','google','linkedin','tiktok')),
  CONSTRAINT client_platform_connections_unique UNIQUE (client_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_client_platform_connections_client_id
ON public.client_platform_connections (client_id);

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_client_platform_connections_updated_at ON public.client_platform_connections;
CREATE TRIGGER update_client_platform_connections_updated_at
BEFORE UPDATE ON public.client_platform_connections
FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

ALTER TABLE public.client_platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client platform connections select" ON public.client_platform_connections;
DROP POLICY IF EXISTS "Client platform connections insert" ON public.client_platform_connections;
DROP POLICY IF EXISTS "Client platform connections update" ON public.client_platform_connections;
DROP POLICY IF EXISTS "Client platform connections delete" ON public.client_platform_connections;

CREATE POLICY "Client platform connections select" ON public.client_platform_connections
FOR SELECT TO authenticated
USING (public.can_access_client(client_id));

CREATE POLICY "Client platform connections insert" ON public.client_platform_connections
FOR INSERT TO authenticated
WITH CHECK (public.can_access_client(client_id));

CREATE POLICY "Client platform connections update" ON public.client_platform_connections
FOR UPDATE TO authenticated
USING (public.can_access_client(client_id))
WITH CHECK (public.can_access_client(client_id));

CREATE POLICY "Client platform connections delete" ON public.client_platform_connections
FOR DELETE TO authenticated
USING (public.can_access_client(client_id));
