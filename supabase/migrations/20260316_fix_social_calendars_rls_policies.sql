DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'social_calendars') THEN
    EXECUTE 'ALTER TABLE public.social_calendars ENABLE ROW LEVEL SECURITY';
  ELSE
    RETURN;
  END IF;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'social_calendars'
  LOOP
    IF pol.policyname NOT IN (
      'Agency users can manage social calendars',
      'Client Portal can read own social calendars',
      'Client Portal can approve own social calendars'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.social_calendars', pol.policyname);
    END IF;
  END LOOP;

  EXECUTE 'DROP POLICY IF EXISTS "Agency users can manage social calendars" ON public.social_calendars';
  EXECUTE $pol$
    CREATE POLICY "Agency users can manage social calendars"
    ON public.social_calendars
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.colaboradores col
        WHERE col.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.colaboradores col
        WHERE col.user_id = auth.uid()
      )
    )
  $pol$;

  EXECUTE 'DROP POLICY IF EXISTS "Client Portal can read own social calendars" ON public.social_calendars';
  EXECUTE $pol$
    CREATE POLICY "Client Portal can read own social calendars"
    ON public.social_calendars
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.client_portal_users cpu
        JOIN public.clientes c ON c.id = social_calendars.cliente_id
        WHERE cpu.user_id = auth.uid()
          AND cpu.client_id = social_calendars.cliente_id
          AND cpu.tenant_id = c.tenant_id
      )
    )
  $pol$;

  EXECUTE 'DROP POLICY IF EXISTS "Client Portal can approve own social calendars" ON public.social_calendars';
  EXECUTE $pol$
    CREATE POLICY "Client Portal can approve own social calendars"
    ON public.social_calendars
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.client_portal_users cpu
        JOIN public.clientes c ON c.id = social_calendars.cliente_id
        WHERE cpu.user_id = auth.uid()
          AND cpu.client_id = social_calendars.cliente_id
          AND cpu.tenant_id = c.tenant_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.client_portal_users cpu
        JOIN public.clientes c ON c.id = social_calendars.cliente_id
        WHERE cpu.user_id = auth.uid()
          AND cpu.client_id = social_calendars.cliente_id
          AND cpu.tenant_id = c.tenant_id
      )
      AND social_calendars.status IN ('approved','needs_changes')
    )
  $pol$;
END $$;

