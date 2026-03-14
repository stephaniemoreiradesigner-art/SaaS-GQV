-- Portal do Cliente V2: permitir leitura e aprovação de calendários editoriais (social_calendars) e leitura de itens (social_calendar_items)

ALTER TABLE IF EXISTS public.social_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_calendar_items ENABLE ROW LEVEL SECURITY;

-- Políticas: Agência (colaboradores) podem gerenciar
DROP POLICY IF EXISTS "Agency users can manage social calendars" ON public.social_calendars;
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
);

DROP POLICY IF EXISTS "Agency users can manage social calendar items" ON public.social_calendar_items;
CREATE POLICY "Agency users can manage social calendar items"
ON public.social_calendar_items
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
);

-- Políticas: Portal do Cliente pode ler seus calendários
DROP POLICY IF EXISTS "Client Portal can read own social calendars" ON public.social_calendars;
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
);

-- Políticas: Portal do Cliente pode ler itens do planejamento do seu calendário
DROP POLICY IF EXISTS "Client Portal can read own social calendar items" ON public.social_calendar_items;
CREATE POLICY "Client Portal can read own social calendar items"
ON public.social_calendar_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.social_calendars sc
    JOIN public.client_portal_users cpu ON cpu.client_id = sc.cliente_id
    JOIN public.clientes c ON c.id = sc.cliente_id
    WHERE sc.id = social_calendar_items.calendar_id
      AND cpu.user_id = auth.uid()
      AND cpu.tenant_id = c.tenant_id
  )
);

-- Políticas: Portal do Cliente pode atualizar status/comentário do seu calendário (aprovar ou solicitar ajustes)
DROP POLICY IF EXISTS "Client Portal can approve own social calendars" ON public.social_calendars;
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
);

CREATE OR REPLACE FUNCTION public.enforce_client_portal_social_calendars_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.colaboradores col WHERE col.user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_portal_users cpu
    WHERE cpu.user_id = auth.uid()
      AND cpu.client_id = OLD.cliente_id
  ) THEN
    IF (to_jsonb(NEW) - 'status' - 'comentario_cliente' - 'updated_at')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'status' - 'comentario_cliente' - 'updated_at') THEN
      RAISE EXCEPTION 'client_portal_calendar_update_not_allowed';
    END IF;

    IF NEW.status IS NULL OR NEW.status NOT IN ('approved','needs_changes') THEN
      RAISE EXCEPTION 'client_portal_invalid_calendar_status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_client_portal_social_calendars_update ON public.social_calendars;
CREATE TRIGGER enforce_client_portal_social_calendars_update
BEFORE UPDATE ON public.social_calendars
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_portal_social_calendars_update();
