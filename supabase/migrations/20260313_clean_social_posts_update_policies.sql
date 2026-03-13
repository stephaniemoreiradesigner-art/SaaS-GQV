-- chore(db): clean social_posts update policies after portal approval fix
-- Objetivo: manter apenas
-- 1) Agency users can manage posts (colaboradores)
-- 2) Client Portal can approve own social posts (client_portal_users)

ALTER TABLE IF EXISTS public.social_posts ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas/redundantes (investigação e compatibilidade)
DROP POLICY IF EXISTS "Client can approve own posts" ON public.social_posts;
DROP POLICY IF EXISTS "Client can approve own posts via calendar" ON public.social_posts;
DROP POLICY IF EXISTS "Publico pode atualizar posts em aprovação" ON public.social_posts;
DROP POLICY IF EXISTS "Posts Update Public Approval" ON public.social_posts;
DROP POLICY IF EXISTS "Acesso autenticado posts" ON public.social_posts;
DROP POLICY IF EXISTS "Acesso Total Posts" ON public.social_posts;
DROP POLICY IF EXISTS "Equipe gerencia posts" ON public.social_posts;
DROP POLICY IF EXISTS "Posts Manage AdminOrSocial" ON public.social_posts;
DROP POLICY IF EXISTS "Colaboradores podem gerenciar posts" ON public.social_posts;

-- Recriar policy final (Agência)
DROP POLICY IF EXISTS "Agency users can manage posts" ON public.social_posts;

CREATE POLICY "Agency users can manage posts"
ON public.social_posts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.colaboradores
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.colaboradores
    WHERE user_id = auth.uid()
  )
);

-- Recriar policy final (Portal do Cliente)
DROP POLICY IF EXISTS "Client Portal can approve own social posts" ON public.social_posts;

CREATE POLICY "Client Portal can approve own social posts"
ON public.social_posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_portal_users cpu
    JOIN public.clientes c ON c.id = social_posts.cliente_id
    WHERE cpu.user_id = auth.uid()
      AND cpu.client_id = social_posts.cliente_id
      AND cpu.tenant_id = c.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.client_portal_users cpu
    JOIN public.clientes c ON c.id = social_posts.cliente_id
    WHERE cpu.user_id = auth.uid()
      AND cpu.client_id = social_posts.cliente_id
      AND cpu.tenant_id = c.tenant_id
  )
  AND social_posts.status IN ('approved','changes_requested')
);

