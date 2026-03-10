ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client can approve own posts" ON public.social_posts;
DROP POLICY IF EXISTS "Client can approve own posts via calendar" ON public.social_posts;

CREATE POLICY "Client can approve own posts via calendar"
ON public.social_posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.social_calendars sc
    JOIN public.clientes c ON c.id = sc.cliente_id
    WHERE sc.id = social_posts.calendar_id
      AND lower(c.email) = lower((auth.jwt() ->> 'email'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.social_calendars sc
    JOIN public.clientes c ON c.id = sc.cliente_id
    WHERE sc.id = social_posts.calendar_id
      AND lower(c.email) = lower((auth.jwt() ->> 'email'))
  )
  AND social_posts.status IN ('approved','changes_requested')
);

