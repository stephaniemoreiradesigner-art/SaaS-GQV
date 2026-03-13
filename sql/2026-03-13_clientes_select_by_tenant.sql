-- 2026-03-13_clientes_select_by_tenant.sql
-- Corrige a policy de SELECT em public.clientes para listar todos os clientes do tenant.

ALTER TABLE IF EXISTS public.clientes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tenant_col_type text;
BEGIN
  SELECT c.data_type
    INTO tenant_col_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'clientes'
    AND c.column_name = 'tenant_id';

  EXECUTE 'DROP POLICY IF EXISTS "Clientes Select Auth" ON public.clientes';

  IF tenant_col_type = 'uuid' THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.current_tenant_uuid()
      RETURNS UUID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
      DECLARE
        jwt_tenant text;
        membership_tenant uuid;
      BEGIN
        jwt_tenant := auth.jwt() ->> 'tenant_id';
        IF jwt_tenant IS NOT NULL AND jwt_tenant ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
          RETURN jwt_tenant::uuid;
        END IF;

        SELECT tm.tenant_id
          INTO membership_tenant
        FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid()
        ORDER BY tm.created_at ASC
        LIMIT 1;

        RETURN membership_tenant;
      END;
      $$;
    $fn$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.is_tenant_match_uuid(target_id UUID)
      RETURNS BOOLEAN
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
        SELECT public.is_admin() OR (target_id = public.current_tenant_uuid());
      $$;
    $fn$;

    EXECUTE $pol$
      CREATE POLICY "Clientes Select Auth" ON public.clientes
      FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR public.is_tenant_match_uuid(tenant_id)
        OR responsavel_trafego_colaborador_id = public.current_colaborador_id()
        OR responsavel_social_colaborador_id = public.current_colaborador_id()
        OR lower(gestor_trafego_email) = lower(auth.email())
        OR lower(social_media_email) = lower(auth.email())
      );
    $pol$;
  ELSIF tenant_col_type = 'bigint' THEN
    EXECUTE $pol$
      CREATE POLICY "Clientes Select Auth" ON public.clientes
      FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR public.is_tenant_match(tenant_id)
        OR responsavel_trafego_colaborador_id = public.current_colaborador_id()
        OR responsavel_social_colaborador_id = public.current_colaborador_id()
        OR lower(gestor_trafego_email) = lower(auth.email())
        OR lower(social_media_email) = lower(auth.email())
      );
    $pol$;
  ELSE
    EXECUTE $pol$
      CREATE POLICY "Clientes Select Auth" ON public.clientes
      FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR public.is_tenant_match(id)
        OR responsavel_trafego_colaborador_id = public.current_colaborador_id()
        OR responsavel_social_colaborador_id = public.current_colaborador_id()
        OR lower(gestor_trafego_email) = lower(auth.email())
        OR lower(social_media_email) = lower(auth.email())
      );
    $pol$;
  END IF;
END $$;

