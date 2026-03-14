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
  has_decision boolean;
  version_id_value uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  old_status := to_jsonb(OLD)->>'status';
  new_status := to_jsonb(NEW)->>'status';

  IF old_status IS NOT DISTINCT FROM new_status THEN
    RETURN NEW;
  END IF;

  IF new_status IN ('ready_for_approval', 'awaiting_approval') THEN
    decision_value := 'resubmitted';
  ELSIF new_status = 'approved' THEN
    decision_value := 'approved';
  ELSIF new_status IN ('changes_requested', 'rejected') THEN
    decision_value := 'changes_requested';
  ELSE
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_approvals'
      AND column_name = 'decision'
  ) INTO has_decision;

  IF NOT has_decision THEN
    RETURN NEW;
  END IF;

  comment_text := NULLIF(COALESCE(
    to_jsonb(NEW)->>'comentario_cliente',
    to_jsonb(NEW)->>'feedback_aprovacao',
    to_jsonb(NEW)->>'feedback_ajuste',
    (to_jsonb(NEW)->'feedback_cliente'->>'comentario')
  ), '');

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

  INSERT INTO public.social_approvals (
    post_id,
    version_id,
    decision,
    decided_by,
    decided_at,
    comment
  )
  VALUES (
    NEW.id,
    version_id_value,
    decision_value,
    auth.uid(),
    now(),
    comment_text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_posts_audit_status_change ON public.social_posts;
CREATE TRIGGER social_posts_audit_status_change
AFTER UPDATE OF status ON public.social_posts
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.log_social_post_status_change();
