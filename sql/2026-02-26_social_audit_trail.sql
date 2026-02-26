CREATE TABLE IF NOT EXISTS public.social_post_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    snapshot JSONB NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, post_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.social_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.social_post_versions(id) ON DELETE RESTRICT,
    decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
    decided_by UUID NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason_code TEXT NULL,
    comment TEXT NULL,
    meta JSONB NULL
);

CREATE TABLE IF NOT EXISTS public.social_post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id BIGINT NOT NULL,
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    version_id UUID NULL REFERENCES public.social_post_versions(id) ON DELETE SET NULL,
    author_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    type TEXT NOT NULL CHECK (type IN ('general','change_request','approval_note')),
    thread_key TEXT NULL,
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS social_post_versions_tenant_post_version_idx
ON public.social_post_versions (tenant_id, post_id, version_number DESC);

CREATE INDEX IF NOT EXISTS social_approvals_tenant_post_decided_idx
ON public.social_approvals (tenant_id, post_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS social_post_comments_tenant_post_created_idx
ON public.social_post_comments (tenant_id, post_id, created_at DESC);

ALTER TABLE public.social_post_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;

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
WITH CHECK (public.is_tenant_match(tenant_id) AND decided_by = auth.uid());

CREATE POLICY "Social Post Comments Select"
ON public.social_post_comments
FOR SELECT TO authenticated
USING (public.is_tenant_match(tenant_id));

CREATE POLICY "Social Post Comments Insert"
ON public.social_post_comments
FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_match(tenant_id) AND author_id = auth.uid());
