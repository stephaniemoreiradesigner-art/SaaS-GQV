ALTER TABLE IF EXISTS public.social_posts
DROP CONSTRAINT IF EXISTS social_posts_status_check;

ALTER TABLE IF EXISTS public.social_posts
ADD CONSTRAINT social_posts_status_check
CHECK (
  status IN (
    'draft',
    'ready_for_review',
    'briefing_sent',
    'design_in_progress',
    'in_production',
    'awaiting_approval',
    'ready_for_approval',
    'approved',
    'changes_requested',
    'rejected',
    'scheduled',
    'published',
    'archived',
    'rascunho',
    'aguardando_aprovacao',
    'aguardando_aprovação',
    'pendente_aprovacao',
    'pendente_aprovação',
    'aprovado',
    'ajuste_solicitado',
    'ajuste_em_andamento',
    'agendado',
    'publicado',
    'concluido',
    'concluído'
  )
);
