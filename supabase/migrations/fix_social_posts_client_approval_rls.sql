ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client can approve own posts" ON public.social_posts;

CREATE POLICY "Client can approve own posts"
ON public.social_posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = social_posts.cliente_id
      AND lower(c.email) = lower((auth.jwt() ->> 'email'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = social_posts.cliente_id
      AND lower(c.email) = lower((auth.jwt() ->> 'email'))
  )
  AND social_posts.status IN ('approved','changes_requested')
);

