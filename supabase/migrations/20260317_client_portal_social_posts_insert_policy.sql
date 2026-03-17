ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client can create own posts via calendar" ON public.social_posts;

CREATE POLICY "Client can create own posts via calendar"
ON public.social_posts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.social_calendars sc
    JOIN public.clientes c ON c.id = sc.cliente_id
    WHERE sc.id = social_posts.calendar_id
      AND lower(c.email) = lower((auth.jwt() ->> 'email'))
  )
  AND social_posts.status IN ('approved','changes_requested')
  AND (
    social_posts.calendar_item_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.social_calendar_items i
      WHERE i.id = social_posts.calendar_item_id
        AND i.calendar_id = social_posts.calendar_id
    )
  )
);
