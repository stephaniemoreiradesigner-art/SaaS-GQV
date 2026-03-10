-- 2026-03-10_client_portal_users_rls.sql
-- Portal do Cliente: habilitar RLS e permitir que o usuário crie seu próprio vínculo

ALTER TABLE IF EXISTS public.client_portal_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Portal Users Select Own Link" ON public.client_portal_users;
DROP POLICY IF EXISTS "Portal Users Insert Own Link" ON public.client_portal_users;
DROP POLICY IF EXISTS "Portal Users Update Own Link" ON public.client_portal_users;
DROP POLICY IF EXISTS "Portal Users Delete Own Link" ON public.client_portal_users;

CREATE POLICY "Portal Users Select Own Link"
ON public.client_portal_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Portal Users Insert Own Link"
ON public.client_portal_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Portal Users Update Own Link"
ON public.client_portal_users
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Portal Users Delete Own Link"
ON public.client_portal_users
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_users TO authenticated;
