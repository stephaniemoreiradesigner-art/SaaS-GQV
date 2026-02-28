CREATE TABLE IF NOT EXISTS public.social_post_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    snapshot_json JSONB NOT NULL,
    diff_json JSONB NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.social_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.social_post_versions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('approved','rejected','needs_revision')),
    decision_comment TEXT NULL,
    actor_user_id UUID NOT NULL,
    metadata_json JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    parent_comment_id UUID NULL REFERENCES public.social_post_comments(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL,
    comment_type TEXT NOT NULL DEFAULT 'comment' CHECK (comment_type IN ('comment','decision','system')),
    body TEXT NOT NULL,
    target_json JSONB NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_post_versions ADD COLUMN IF NOT EXISTS snapshot_json JSONB;
ALTER TABLE public.social_post_versions ADD COLUMN IF NOT EXISTS diff_json JSONB;

UPDATE public.social_post_versions
SET snapshot_json = snapshot
WHERE snapshot_json IS NULL AND snapshot IS NOT NULL;

UPDATE public.social_post_versions
SET snapshot_json = '{}'::jsonb
WHERE snapshot_json IS NULL;

ALTER TABLE public.social_post_versions ALTER COLUMN snapshot_json SET NOT NULL;

ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS decision_comment TEXT;
ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS actor_user_id UUID;
ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE public.social_approvals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE public.social_approvals
SET status = decision
WHERE status IS NULL AND decision IS NOT NULL;

UPDATE public.social_approvals
SET decision_comment = comment
WHERE decision_comment IS NULL AND comment IS NOT NULL;

UPDATE public.social_approvals
SET actor_user_id = decided_by
WHERE actor_user_id IS NULL AND decided_by IS NOT NULL;

UPDATE public.social_approvals
SET metadata_json = meta
WHERE metadata_json IS NULL AND meta IS NOT NULL;

UPDATE public.social_approvals
SET created_at = decided_at
WHERE created_at IS NULL AND decided_at IS NOT NULL;

UPDATE public.social_approvals
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.social_approvals ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.social_approvals ALTER COLUMN actor_user_id SET NOT NULL;
ALTER TABLE public.social_approvals ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.social_approvals DROP CONSTRAINT IF EXISTS social_approvals_status_check;
ALTER TABLE public.social_approvals ADD CONSTRAINT social_approvals_status_check CHECK (status IN ('approved','rejected','needs_revision'));

ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS author_user_id UUID;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS comment_type TEXT;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS target_json JSONB;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.social_post_comments
SET author_user_id = author_id
WHERE author_user_id IS NULL AND author_id IS NOT NULL;

UPDATE public.social_post_comments
SET comment_type = CASE type
    WHEN 'approval_note' THEN 'decision'
    WHEN 'change_request' THEN 'decision'
    ELSE 'comment'
END
WHERE comment_type IS NULL;

UPDATE public.social_post_comments
SET body = COALESCE(payload->>'text', '')
WHERE body IS NULL;

UPDATE public.social_post_comments
SET target_json = payload
WHERE target_json IS NULL AND payload IS NOT NULL;

UPDATE public.social_post_comments
SET status = 'open'
WHERE status IS NULL;

UPDATE public.social_post_comments
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.social_post_comments
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.social_post_comments ALTER COLUMN author_user_id SET NOT NULL;
ALTER TABLE public.social_post_comments ALTER COLUMN comment_type SET NOT NULL;
ALTER TABLE public.social_post_comments ALTER COLUMN body SET NOT NULL;
ALTER TABLE public.social_post_comments ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.social_post_comments ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.social_post_comments ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.social_post_comments DROP CONSTRAINT IF EXISTS social_post_comments_comment_type_check;
ALTER TABLE public.social_post_comments ADD CONSTRAINT social_post_comments_comment_type_check CHECK (comment_type IN ('comment','decision','system'));
ALTER TABLE public.social_post_comments DROP CONSTRAINT IF EXISTS social_post_comments_status_check;
ALTER TABLE public.social_post_comments ADD CONSTRAINT social_post_comments_status_check CHECK (status IN ('open','resolved'));

CREATE INDEX IF NOT EXISTS social_post_versions_tenant_post_version_idx
ON public.social_post_versions (tenant_id, post_id, version_number DESC);

CREATE INDEX IF NOT EXISTS social_post_versions_post_version_idx
ON public.social_post_versions (post_id, version_number DESC);

CREATE INDEX IF NOT EXISTS social_approvals_tenant_post_created_idx
ON public.social_approvals (tenant_id, post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS social_post_comments_tenant_post_created_idx
ON public.social_post_comments (tenant_id, post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS social_post_comments_parent_idx
ON public.social_post_comments (parent_comment_id);

ALTER TABLE public.social_post_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.set_social_audit_defaults() CASCADE;
CREATE FUNCTION public.set_social_audit_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    current_user_id UUID;
    current_tenant_id BIGINT;
BEGIN
    current_user_id := auth.uid();
    SELECT tenant_id INTO current_tenant_id FROM public.profiles WHERE id = current_user_id;
    IF current_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id_nao_encontrado';
    END IF;
    NEW.tenant_id := COALESCE(NEW.tenant_id, current_tenant_id);
    IF TG_TABLE_NAME = 'social_post_versions' THEN
        NEW.created_by := COALESCE(NEW.created_by, current_user_id);
    ELSIF TG_TABLE_NAME = 'social_approvals' THEN
        NEW.actor_user_id := COALESCE(NEW.actor_user_id, current_user_id);
    ELSIF TG_TABLE_NAME = 'social_post_comments' THEN
        NEW.author_user_id := COALESCE(NEW.author_user_id, current_user_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.enforce_social_approval_comment() CASCADE;
CREATE FUNCTION public.enforce_social_approval_comment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM 'approved' THEN
        IF NEW.decision_comment IS NULL OR btrim(NEW.decision_comment) = '' THEN
            RAISE EXCEPTION 'decision_comment_obrigatorio';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.set_social_comment_updated_at() CASCADE;
CREATE FUNCTION public.set_social_comment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_post_versions_defaults ON public.social_post_versions;
CREATE TRIGGER social_post_versions_defaults
BEFORE INSERT ON public.social_post_versions
FOR EACH ROW
EXECUTE FUNCTION public.set_social_audit_defaults();

DROP TRIGGER IF EXISTS social_approvals_defaults ON public.social_approvals;
CREATE TRIGGER social_approvals_defaults
BEFORE INSERT ON public.social_approvals
FOR EACH ROW
EXECUTE FUNCTION public.set_social_audit_defaults();

DROP TRIGGER IF EXISTS social_approvals_comment_guard ON public.social_approvals;
CREATE TRIGGER social_approvals_comment_guard
BEFORE INSERT ON public.social_approvals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_social_approval_comment();

DROP TRIGGER IF EXISTS social_post_comments_defaults ON public.social_post_comments;
CREATE TRIGGER social_post_comments_defaults
BEFORE INSERT ON public.social_post_comments
FOR EACH ROW
EXECUTE FUNCTION public.set_social_audit_defaults();

DROP TRIGGER IF EXISTS social_post_comments_updated_at ON public.social_post_comments;
CREATE TRIGGER social_post_comments_updated_at
BEFORE UPDATE ON public.social_post_comments
FOR EACH ROW
EXECUTE FUNCTION public.set_social_comment_updated_at();

DROP POLICY IF EXISTS "Social Post Versions Select" ON public.social_post_versions;
DROP POLICY IF EXISTS "Social Post Versions Insert" ON public.social_post_versions;
DROP POLICY IF EXISTS "Social Approvals Select" ON public.social_approvals;
DROP POLICY IF EXISTS "Social Approvals Insert" ON public.social_approvals;
DROP POLICY IF EXISTS "Social Post Comments Select" ON public.social_post_comments;
DROP POLICY IF EXISTS "Social Post Comments Insert" ON public.social_post_comments;

CREATE POLICY "Social Post Versions Select"
ON public.social_post_versions
FOR SELECT TO authenticated
USING (public.is_tenant_match(tenant_id));

CREATE POLICY "Social Post Versions Insert"
ON public.social_post_versions
FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_match(tenant_id) AND created_by = auth.uid());

CREATE POLICY "Social Approvals Select"
ON public.social_approvals
FOR SELECT TO authenticated
USING (public.is_tenant_match(tenant_id));

CREATE POLICY "Social Approvals Insert"
ON public.social_approvals
FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_match(tenant_id) AND actor_user_id = auth.uid());

CREATE POLICY "Social Post Comments Select"
ON public.social_post_comments
FOR SELECT TO authenticated
USING (public.is_tenant_match(tenant_id));

CREATE POLICY "Social Post Comments Insert"
ON public.social_post_comments
FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_match(tenant_id) AND author_user_id = auth.uid());
