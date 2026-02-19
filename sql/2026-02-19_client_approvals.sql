ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id uuid;

CREATE TABLE IF NOT EXISTS public.client_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL,
    type text NOT NULL CHECK (type IN ('post','calendar')),
    item_id uuid NOT NULL,
    title text NOT NULL,
    preview_url text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested')),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_approval_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id uuid NOT NULL REFERENCES public.client_approvals(id) ON DELETE CASCADE,
    author_role text NOT NULL CHECK (author_role IN ('client','team')),
    comment text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_approvals_client_type_status_idx
    ON public.client_approvals (client_id, type, status);

CREATE INDEX IF NOT EXISTS client_approval_comments_approval_created_idx
    ON public.client_approval_comments (approval_id, created_at);
