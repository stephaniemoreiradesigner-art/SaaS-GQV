-- 2026-03-03_clientes_rls_hotfix.sql
-- Hotfix RLS para tabela clientes: permitir INSERT/UPDATE por tenant

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Clientes Insert Tenant" ON public.clientes';
    EXECUTE 'DROP POLICY IF EXISTS "Clientes Update Tenant" ON public.clientes';

    EXECUTE '
      CREATE POLICY "Clientes Insert Tenant" ON public.clientes
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin()
        OR public.is_tenant_match(tenant_id)
      )
    ';

    EXECUTE '
      CREATE POLICY "Clientes Update Tenant" ON public.clientes
      FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR public.is_tenant_match(tenant_id)
        OR responsavel_trafego_colaborador_id = public.current_colaborador_id()
        OR responsavel_social_colaborador_id = public.current_colaborador_id()
        OR lower(gestor_trafego_email) = lower(auth.email())
        OR lower(social_media_email) = lower(auth.email())
      )
      WITH CHECK (
        public.is_admin()
        OR public.is_tenant_match(tenant_id)
        OR responsavel_trafego_colaborador_id = public.current_colaborador_id()
        OR responsavel_social_colaborador_id = public.current_colaborador_id()
        OR lower(gestor_trafego_email) = lower(auth.email())
        OR lower(social_media_email) = lower(auth.email())
      )
    ';
  ELSE
    EXECUTE 'DROP POLICY IF EXISTS "Clientes Insert Tenant" ON public.clientes';
    EXECUTE 'DROP POLICY IF EXISTS "Clientes Update Tenant" ON public.clientes';

    EXECUTE '
      CREATE POLICY "Clientes Insert Tenant" ON public.clientes
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin()
        OR public.current_tenant_id() IS NOT NULL
      )
    ';

    EXECUTE '
      CREATE POLICY "Clientes Update Tenant" ON public.clientes
      FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR public.is_tenant_match(id)
        OR responsavel_trafego_colaborador_id = public.current_colaborador_id()
        OR responsavel_social_colaborador_id = public.current_colaborador_id()
        OR lower(gestor_trafego_email) = lower(auth.email())
        OR lower(social_media_email) = lower(auth.email())
      )
      WITH CHECK (
        public.is_admin()
        OR public.is_tenant_match(id)
        OR responsavel_trafego_colaborador_id = public.current_colaborador_id()
        OR responsavel_social_colaborador_id = public.current_colaborador_id()
        OR lower(gestor_trafego_email) = lower(auth.email())
        OR lower(social_media_email) = lower(auth.email())
      )
    ';
  END IF;
END $$;
