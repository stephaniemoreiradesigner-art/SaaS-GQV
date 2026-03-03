CREATE TABLE IF NOT EXISTS public.client_portal_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    client_id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_portal_users_user_id_idx ON public.client_portal_users (user_id);
CREATE INDEX IF NOT EXISTS client_portal_users_client_id_idx ON public.client_portal_users (client_id);
CREATE INDEX IF NOT EXISTS client_portal_users_tenant_id_idx ON public.client_portal_users (tenant_id);

ALTER TABLE public.social_calendars ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.social_calendars ADD COLUMN IF NOT EXISTS approval_comment text;
