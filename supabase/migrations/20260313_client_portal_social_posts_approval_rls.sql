-- Portal do Cliente V2: permitir aprovação/ajustes de posts com RLS seguro

ALTER TABLE IF EXISTS public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client Portal can approve own social posts" ON public.social_posts;

CREATE POLICY "Client Portal can approve own social posts"
ON public.social_posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_portal_users cpu
    JOIN public.clientes c ON c.id = social_posts.cliente_id
    WHERE cpu.user_id = auth.uid()
      AND cpu.client_id = social_posts.cliente_id
      AND cpu.tenant_id = c.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.client_portal_users cpu
    JOIN public.clientes c ON c.id = social_posts.cliente_id
    WHERE cpu.user_id = auth.uid()
      AND cpu.client_id = social_posts.cliente_id
      AND cpu.tenant_id = c.tenant_id
  )
  AND social_posts.status IN ('approved','changes_requested')
);

CREATE OR REPLACE FUNCTION public.enforce_client_portal_social_posts_update()
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
    IF (to_jsonb(NEW) - 'status' - 'comentario_cliente' - 'feedback_cliente' - 'feedback_ajuste' - 'feedback_aprovacao' - 'updated_at')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'status' - 'comentario_cliente' - 'feedback_cliente' - 'feedback_ajuste' - 'feedback_aprovacao' - 'updated_at') THEN
      RAISE EXCEPTION 'client_portal_update_not_allowed';
    END IF;

    IF NEW.status IS NULL OR NEW.status NOT IN ('approved','changes_requested') THEN
      RAISE EXCEPTION 'client_portal_invalid_status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_client_portal_social_posts_update ON public.social_posts;

CREATE TRIGGER enforce_client_portal_social_posts_update
BEFORE UPDATE ON public.social_posts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_portal_social_posts_update();

