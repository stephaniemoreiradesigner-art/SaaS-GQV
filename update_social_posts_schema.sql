-- 1. Adicionar coluna 'formato' se não existir (para salvar Reels, Carrossel, etc.)
ALTER TABLE public.social_posts 
ADD COLUMN IF NOT EXISTS formato TEXT;

-- 2. Tornar 'data_agendada' opcional (nullable)
-- Isso permite que o n8n envie posts sem data e o SaaS não dê erro.
ALTER TABLE public.social_posts 
ALTER COLUMN data_agendada DROP NOT NULL;

-- 3. Atualizar a restrição de STATUS para aceitar 'draft' (inglês) e 'rascunho' (português)
-- Isso evita erro se o n8n enviar "draft" direto.
ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;

ALTER TABLE public.social_posts 
ADD CONSTRAINT social_posts_status_check 
CHECK (status IN ('rascunho', 'draft', 'aguardando_aprovacao', 'aprovado', 'approved', 'ajuste_solicitado', 'agendado', 'publicado', 'concluido'));
