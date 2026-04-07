-- 20260407_social_approvals_full_events.sql
-- Estrutura de histórico completo: captura todos os eventos do fluxo social media
-- Adiciona: actor_label, trigger de criação, extensão para todos os status

-- 1. Adicionar actor_label à tabela
ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS actor_label text;

-- 2. Função auxiliar para resolver label do ator atual (colaborador ou portal)
CREATE OR REPLACE FUNCTION public.resolve_actor_label()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  label_val text;
BEGIN
  -- Tenta colaborador (agência)
  BEGIN
    SELECT COALESCE(col.nome, col.name, col.email)
    INTO label_val
    FROM public.colaboradores col
    WHERE col.user_id = auth.uid()
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    label_val := NULL;
  END;

  IF label_val IS NOT NULL THEN
    RETURN label_val;
  END IF;

  -- Tenta client_portal_users (cliente)
  BEGIN
    SELECT COALESCE(cpu.name, cpu.nome, cpu.email)
    INTO label_val
    FROM public.client_portal_users cpu
    WHERE cpu.user_id = auth.uid()
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    label_val := NULL;
  END;

  RETURN label_val;
END;
$$;

-- 3. Trigger extendido: captura TODOS os status changes (não só aprovação)
CREATE OR REPLACE FUNCTION public.log_social_post_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  old_status text;
  new_status text;
  decision_value text;
  comment_text text;
  version_id_value uuid;
  actor_label_value text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  old_status := to_jsonb(OLD)->>'status';
  new_status := to_jsonb(NEW)->>'status';

  IF old_status IS NOT DISTINCT FROM new_status THEN
    RETURN NEW;
  END IF;

  -- Mapear status → decision label (cobre todo o funil)
  IF new_status IN ('ready_for_approval', 'awaiting_approval') THEN
    decision_value := 'resubmitted';
  ELSIF new_status = 'approved' THEN
    decision_value := 'approved';
  ELSIF new_status IN ('changes_requested', 'rejected') THEN
    decision_value := 'changes_requested';
  ELSIF new_status = 'scheduled' THEN
    decision_value := 'scheduled';
  ELSIF new_status = 'published' THEN
    decision_value := 'published';
  ELSIF new_status IN ('ready_for_review', 'in_production', 'producing', 'in_review') THEN
    decision_value := 'in_review';
  ELSIF new_status = 'draft' THEN
    decision_value := 'returned_to_draft';
  ELSE
    decision_value := 'status_change';
  END IF;

  comment_text := NULLIF(COALESCE(
    to_jsonb(NEW)->>'comentario_cliente',
    to_jsonb(NEW)->>'feedback_aprovacao',
    to_jsonb(NEW)->>'feedback_ajuste',
    (to_jsonb(NEW)->'feedback_cliente'->>'comentario')
  ), '');

  -- Resolver label do ator
  BEGIN
    actor_label_value := public.resolve_actor_label();
  EXCEPTION WHEN OTHERS THEN
    actor_label_value := NULL;
  END;

  -- Resolver version_id (se tabela existir)
  version_id_value := NULL;
  BEGIN
    SELECT v.id
    INTO version_id_value
    FROM public.social_post_versions v
    WHERE v.post_id = NEW.id
    ORDER BY v.version_number DESC NULLS LAST, v.created_at DESC
    LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    version_id_value := NULL;
  END;

  -- Inserir evento (nunca falhar a operação principal)
  BEGIN
    INSERT INTO public.social_approvals (
      post_id,
      version_id,
      decision,
      decided_by,
      decided_at,
      comment,
      status_anterior,
      status_novo,
      actor_label
    )
    VALUES (
      NEW.id,
      version_id_value,
      decision_value,
      auth.uid(),
      now(),
      comment_text,
      old_status,
      new_status,
      actor_label_value
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_posts_audit_status_change ON public.social_posts;
CREATE TRIGGER social_posts_audit_status_change
AFTER UPDATE OF status ON public.social_posts
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.log_social_post_status_change();

-- 4. Trigger de criação do post
CREATE OR REPLACE FUNCTION public.log_social_post_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  actor_label_value text;
BEGIN
  BEGIN
    actor_label_value := public.resolve_actor_label();
  EXCEPTION WHEN OTHERS THEN
    actor_label_value := NULL;
  END;

  BEGIN
    INSERT INTO public.social_approvals (
      post_id,
      decision,
      decided_by,
      decided_at,
      comment,
      status_anterior,
      status_novo,
      actor_label
    )
    VALUES (
      NEW.id,
      'created',
      auth.uid(),
      now(),
      NULL,
      NULL,
      NEW.status,
      actor_label_value
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_posts_audit_created ON public.social_posts;
CREATE TRIGGER social_posts_audit_created
AFTER INSERT ON public.social_posts
FOR EACH ROW
EXECUTE FUNCTION public.log_social_post_created();

-- 5. RLS: portal do cliente pode ler histórico dos seus próprios posts
DROP POLICY IF EXISTS "Client Portal can read their posts audit events" ON public.social_approvals;
CREATE POLICY "Client Portal can read their posts audit events"
ON public.social_approvals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.social_posts sp
    JOIN public.client_portal_users cpu ON cpu.client_id = sp.cliente_id
    WHERE sp.id = social_approvals.post_id
      AND cpu.user_id = auth.uid()
  )
);

-- Garantir grant (idempotente)
GRANT SELECT ON public.social_approvals TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_actor_label() TO authenticated;
