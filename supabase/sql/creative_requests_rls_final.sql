ALTER TABLE public.creative_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_requests FORCE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'creative_requests'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.creative_requests', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "CreativeRequests Select TenantOrAdmin"
ON public.creative_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  )
  OR tenant_id = (
    SELECT tenant_id
    FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "CreativeRequests Insert Tenant"
ON public.creative_requests
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (
    SELECT tenant_id
    FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "CreativeRequests Update Role"
ON public.creative_requests
FOR UPDATE
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id
    FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  )
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin','gestor','social','designer')
  )
)
WITH CHECK (
  tenant_id = (
    SELECT tenant_id
    FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  )
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin','gestor','social','designer')
  )
  AND requested_by = (
    SELECT cr.requested_by
    FROM public.creative_requests cr
    WHERE cr.id_uuid = creative_requests.id_uuid
  )
);

CREATE INDEX IF NOT EXISTS creative_requests_tenant_id_idx ON public.creative_requests (tenant_id);
CREATE INDEX IF NOT EXISTS creative_requests_status_idx ON public.creative_requests (status);
CREATE INDEX IF NOT EXISTS creative_requests_deadline_date_idx ON public.creative_requests (deadline_date);
