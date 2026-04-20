-- 20260420_social_post_history.sql
-- Fonte unica de verdade para trilha de eventos de posts social media

CREATE TABLE IF NOT EXISTS public.social_post_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  post_id uuid NOT NULL,
  calendar_item_id uuid NULL,
  event_code text NOT NULL,
  event_label text NOT NULL,
  event_scope text NOT NULL CHECK (event_scope IN ('content', 'media', 'system')),
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'agency_user', 'client')),
  actor_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_post_history_tenant_idx
  ON public.social_post_history (tenant_id);

CREATE INDEX IF NOT EXISTS social_post_history_post_idx
  ON public.social_post_history (post_id);

CREATE INDEX IF NOT EXISTS social_post_history_created_desc_idx
  ON public.social_post_history (created_at DESC);

ALTER TABLE public.social_post_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.social_post_history TO authenticated;

DROP POLICY IF EXISTS "Agency can read social_post_history by tenant" ON public.social_post_history;
CREATE POLICY "Agency can read social_post_history by tenant"
ON public.social_post_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.colaboradores col
    WHERE col.user_id = auth.uid()
      AND col.tenant_id = social_post_history.tenant_id
  )
);

DROP POLICY IF EXISTS "Agency can insert social_post_history by tenant" ON public.social_post_history;
CREATE POLICY "Agency can insert social_post_history by tenant"
ON public.social_post_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.colaboradores col
    WHERE col.user_id = auth.uid()
      AND col.tenant_id = social_post_history.tenant_id
  )
);

DROP POLICY IF EXISTS "Client Portal can read social_post_history by post" ON public.social_post_history;
CREATE POLICY "Client Portal can read social_post_history by post"
ON public.social_post_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.social_posts sp
    JOIN public.client_portal_users cpu ON cpu.client_id = sp.cliente_id
    WHERE sp.id = social_post_history.post_id
      AND cpu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Client Portal can insert social_post_history by post" ON public.social_post_history;
CREATE POLICY "Client Portal can insert social_post_history by post"
ON public.social_post_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.social_posts sp
    JOIN public.client_portal_users cpu ON cpu.client_id = sp.cliente_id
    WHERE sp.id = social_post_history.post_id
      AND cpu.user_id = auth.uid()
  )
);
