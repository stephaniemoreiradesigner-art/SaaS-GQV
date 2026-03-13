-- fix(db): allow changes_requested in social_posts status constraint
-- Mantém compatibilidade com status legados e v2.

ALTER TABLE IF EXISTS public.social_posts
DROP CONSTRAINT IF EXISTS social_posts_status_check;

ALTER TABLE IF EXISTS public.social_posts
ADD CONSTRAINT social_posts_status_check
CHECK (
  status IN (
    -- Canonical (v2)
    'draft',
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

    -- Legado PT-BR (compatibilidade)
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

