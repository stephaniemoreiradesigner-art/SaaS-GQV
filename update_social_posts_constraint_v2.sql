-- Atualiza a constraint de status da tabela social_posts para incluir novos status utilizados no frontend e lógica de tarefas
-- Novos status incluídos: 'ajuste_em_andamento', 'pendente_aprovação'

ALTER TABLE public.social_posts 
DROP CONSTRAINT IF EXISTS social_posts_status_check;

ALTER TABLE public.social_posts 
ADD CONSTRAINT social_posts_status_check 
CHECK (status IN (
    'rascunho', 
    'draft', 
    'aguardando_aprovacao', 
    'pendente_aprovação', -- Usado no JS
    'pendente_aprovacao', -- Versão sem acento por compatibilidade futura
    'aprovado', 
    'approved', 
    'ajuste_solicitado', 
    'ajuste_em_andamento', -- Usado no JS
    'agendado', 
    'publicado', 
    'concluido'
));
