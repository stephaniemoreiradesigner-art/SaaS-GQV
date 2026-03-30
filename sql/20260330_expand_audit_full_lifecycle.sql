-- =============================================================
-- Expansão do audit trail de social_posts para ciclo completo
-- Registra TODOS os status changes (não só aprovações)
-- e cria evento de criação via INSERT trigger
-- =============================================================

-- 1. Garantir coluna actor_label para armazenar label legível (email/nome)
ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS actor_label text;

-- 2. Garantir coluna action_type para compatibilidade com schema antigo
ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS action_type text;

-- 3. Garantir coluna created_at (pode ser decidido_at em schemas antigos)
ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------
-- Trigger UPDATE: log de TODAS as mudanças de status
-- ---------------------------------------------------------------
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
  uses_decision_schema boolean;
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

  -- Mapear cada status para um decision_value semântico
  CASE new_status
    WHEN 'approved'                       THEN decision_value := 'approved';
    WHEN 'changes_requested', 'rejected'  THEN decision_value := 'changes_requested';
    WHEN 'ready_for_approval',
         'awaiting_approval'              THEN decision_value := 'submitted';
    WHEN 'ready_for_review'               THEN decision_value := 'in_review';
    WHEN 'scheduled'                      THEN decision_value := 'scheduled';
    WHEN 'published'                      THEN decision_value := 'published';
    WHEN 'draft'                          THEN
      IF old_status IN ('ready_for_approval','awaiting_approval','approved','changes_requested','rejected') THEN
        decision_value := 'returned_to_draft';
      ELSE
        decision_value := 'status_change';
      END IF;
    ELSE
      decision_value := 'status_change';
  END CASE;

  -- Se foi reenvio (voltou para aprovação após changes_requested)
  IF new_status IN ('ready_for_approval','awaiting_approval')
     AND old_status IN ('changes_requested','rejected','draft') THEN
    decision_value := 'resubmitted';
  END IF;

  comment_text := NULLIF(COALESCE(
    to_jsonb(NEW)->>'comentario_cliente',
    to_jsonb(NEW)->>'feedback_aprovacao',
    to_jsonb(NEW)->>'feedback_ajuste',
    (to_jsonb(NEW)->'feedback_cliente'->>'comentario')
  ), '');

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_approvals'
      AND column_name = 'decision'
  ) INTO uses_decision_schema;

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

  BEGIN
    IF uses_decision_schema THEN
      INSERT INTO public.social_approvals (
        post_id, version_id, decision, action_type,
        decided_by, decided_at, created_at, comment
      )
      VALUES (
        NEW.id, version_id_value, decision_value, decision_value,
        auth.uid(), now(), now(), comment_text
      );
    ELSE
      INSERT INTO public.social_approvals (
        post_id, status_anterior, status_novo, action_type,
        comment, actor_user_id, created_at
      )
      VALUES (
        NEW.id, old_status, new_status, decision_value,
        comment_text, auth.uid(), now()
      );
    END IF;
  EXCEPTION WHEN others THEN
    RETURN NEW;
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

-- ---------------------------------------------------------------
-- Trigger INSERT: registra criação do post
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_social_post_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uses_decision_schema boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_approvals'
      AND column_name = 'decision'
  ) INTO uses_decision_schema;

  BEGIN
    IF uses_decision_schema THEN
      INSERT INTO public.social_approvals (
        post_id, decision, action_type,
        decided_by, decided_at, created_at, comment
      )
      VALUES (
        NEW.id, 'created', 'created',
        auth.uid(), now(), now(), NULL
      );
    ELSE
      INSERT INTO public.social_approvals (
        post_id, status_novo, action_type,
        actor_user_id, created_at
      )
      VALUES (
        NEW.id, NEW.status, 'created',
        auth.uid(), now()
      );
    END IF;
  EXCEPTION WHEN others THEN
    -- Não bloquear o INSERT principal por falha no audit
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

-- ---------------------------------------------------------------
-- RLS: permitir que a agência leia todos os eventos de seus posts
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Agency users can read social approvals" ON public.social_approvals;
CREATE POLICY "Agency users can read social approvals"
ON public.social_approvals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.colaboradores col
    WHERE col.user_id = auth.uid()
  )
);

-- RLS: permitir INSERT do trigger (SECURITY DEFINER já bypass, mas deixar explícito)
DROP POLICY IF EXISTS "System can insert social approvals" ON public.social_approvals;
CREATE POLICY "System can insert social approvals"
ON public.social_approvals
FOR INSERT
TO authenticated
WITH CHECK (true);
