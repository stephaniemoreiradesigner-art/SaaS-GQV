CREATE TABLE IF NOT EXISTS public.social_creatives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
    briefing TEXT,
    uploaded_file_url TEXT,
    status TEXT DEFAULT 'pending_design',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'social_creatives_status_check'
    ) THEN
        ALTER TABLE public.social_creatives
        ADD CONSTRAINT social_creatives_status_check
        CHECK (status IN ('pending_design','designing','uploaded','approved','needs_revision'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS social_creatives_tenant_id_idx ON public.social_creatives (tenant_id);
CREATE INDEX IF NOT EXISTS social_creatives_post_id_idx ON public.social_creatives (post_id);
CREATE INDEX IF NOT EXISTS social_creatives_status_idx ON public.social_creatives (status);
