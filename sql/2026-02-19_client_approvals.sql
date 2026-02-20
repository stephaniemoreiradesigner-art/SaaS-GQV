ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id uuid;

CREATE TABLE IF NOT EXISTS public.client_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    client_id bigint NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT client_invites_email_unique UNIQUE (email)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_invites_client_id_unique
    ON public.client_invites (client_id);

ALTER TABLE public.client_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client invites admin select" ON public.client_invites;
DROP POLICY IF EXISTS "Client invites admin insert" ON public.client_invites;
DROP POLICY IF EXISTS "Client invites admin update" ON public.client_invites;
DROP POLICY IF EXISTS "Client invites admin delete" ON public.client_invites;

CREATE POLICY "Client invites admin select" ON public.client_invites
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Client invites admin insert" ON public.client_invites
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Client invites admin update" ON public.client_invites
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Client invites admin delete" ON public.client_invites
FOR DELETE TO authenticated
USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.client_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL,
    type text NOT NULL CHECK (type IN ('post','calendar')),
    item_id uuid NOT NULL,
    title text NOT NULL,
    caption text,
    preview_url text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested')),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_approval_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN ('posts_week')),
    period_start date NOT NULL,
    period_end date NOT NULL,
    share_token uuid NOT NULL DEFAULT gen_random_uuid(),
    access_password text NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT client_approval_batches_period_unique UNIQUE (client_id, kind, period_start, period_end)
);

ALTER TABLE public.client_approvals
ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.client_approval_batches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.client_approval_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id uuid NOT NULL REFERENCES public.client_approvals(id) ON DELETE CASCADE,
    author_role text NOT NULL CHECK (author_role IN ('client','team')),
    comment text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_approval_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id uuid NOT NULL REFERENCES public.client_approvals(id) ON DELETE CASCADE,
    post_id uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
    snapshot jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_approvals_client_type_status_idx
    ON public.client_approvals (client_id, type, status);

CREATE UNIQUE INDEX IF NOT EXISTS client_approvals_unique_item_batch_idx
    ON public.client_approvals (type, item_id, batch_id);

CREATE INDEX IF NOT EXISTS client_approval_comments_approval_created_idx
    ON public.client_approval_comments (approval_id, created_at);

CREATE INDEX IF NOT EXISTS client_approval_items_approval_idx
    ON public.client_approval_items (approval_id);

CREATE INDEX IF NOT EXISTS client_approval_items_post_idx
    ON public.client_approval_items (post_id);

CREATE UNIQUE INDEX IF NOT EXISTS client_approval_items_unique_post
    ON public.client_approval_items (approval_id, post_id)
    WHERE post_id IS NOT NULL;

INSERT INTO public.client_approvals (id, client_id, type, item_id, title, preview_url, status)
VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'post', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Post de exemplo', 'https://exemplo.com/preview-post', 'pending'),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'calendar', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Calendário de exemplo', null, 'pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.client_approval_comments (id, approval_id, author_role, comment)
VALUES
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'team', 'Exemplo: revise o tom do texto.'),
    ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'team', 'Exemplo: valide as datas do calendário.')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.social_posts
ADD COLUMN IF NOT EXISTS medias jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.social_posts
ADD COLUMN IF NOT EXISTS creative_guide jsonb;
