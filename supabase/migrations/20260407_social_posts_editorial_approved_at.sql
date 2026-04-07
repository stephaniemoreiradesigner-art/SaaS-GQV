-- 20260407_social_posts_editorial_approved_at.sql
-- Registra quando um post foi gerado a partir de aprovação editorial
-- Preserva a aprovação editorial independentemente das mudanças de status de produção

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS editorial_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS editorial_item_status text;

COMMENT ON COLUMN public.social_posts.editorial_approved_at IS
  'Data em que o item editorial vinculado foi aprovado pelo cliente. Preenchido uma vez; nunca apagado por mudanças de status de produção.';

COMMENT ON COLUMN public.social_posts.editorial_item_status IS
  'Snapshot do status do calendar_item no momento da transição (ex: approved, needs_changes). Informativo apenas.';

-- Índice para buscas por posts com aprovação editorial registrada
CREATE INDEX IF NOT EXISTS social_posts_editorial_approved_at_idx
  ON public.social_posts (editorial_approved_at)
  WHERE editorial_approved_at IS NOT NULL;
