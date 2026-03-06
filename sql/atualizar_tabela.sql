-- Remover a constraint antiga que está bloqueando o novo status
ALTER TABLE social_posts 
DROP CONSTRAINT IF EXISTS social_posts_status_check;

-- Adicionar uma nova constraint mais flexível
ALTER TABLE social_posts 
ADD CONSTRAINT social_posts_status_check 
CHECK (status IN ('rascunho', 'agendado', 'publicado', 'pendente_aprovação', 'aprovado', 'ajuste_solicitado'));

-- Garantir que as colunas existam (caso a execução anterior tenha falhado parcialmente)
ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'rascunho',
ADD COLUMN IF NOT EXISTS approval_group_id text,
ADD COLUMN IF NOT EXISTS feedback_cliente jsonb,
ADD COLUMN IF NOT EXISTS data_envio_aprovacao timestamp with time zone;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_approval_group ON social_posts(approval_group_id);
