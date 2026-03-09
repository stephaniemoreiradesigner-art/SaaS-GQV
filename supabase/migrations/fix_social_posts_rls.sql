-- Atualização de Política RLS para social_posts
-- Permite que usuários autenticados da Agência gerenciem posts de qualquer cliente
-- (Considerando que colaboradores podem gerenciar qualquer cliente)

-- Remover políticas antigas se existirem para evitar conflito
DROP POLICY IF EXISTS "Colaboradores podem gerenciar posts" ON public.social_posts;
DROP POLICY IF EXISTS "Agency users can manage posts" ON public.social_posts;

-- Criar nova política permissiva para usuários autenticados (Agência)
CREATE POLICY "Agency users can manage posts"
ON public.social_posts
FOR ALL
TO authenticated
USING (
  -- Verifica se o usuário é um colaborador válido ou admin
  EXISTS (
    SELECT 1 FROM public.colaboradores 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.colaboradores 
    WHERE user_id = auth.uid()
  )
);

-- Garantir que a tabela social_posts tenha RLS habilitado
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
