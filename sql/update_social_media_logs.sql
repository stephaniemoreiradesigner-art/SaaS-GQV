-- Atualização para suportar Diário de Bordo de Social Media

-- 1. Remover restrição de tipo_alteracao se existir (para aceitar novos tipos)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'traffic_logs_tipo_alteracao_check') THEN 
        ALTER TABLE public.traffic_logs DROP CONSTRAINT traffic_logs_tipo_alteracao_check; 
    END IF; 
END $$;

-- 2. Adicionar coluna link_criativo
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS link_criativo TEXT;

-- 3. Adicionar coluna status se não existir (garantia) e remover check se existir
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';

-- Se houver check constraint no status, remover também para aceitar 'em_andamento' e 'concluido'
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'traffic_logs_status_check') THEN 
        ALTER TABLE public.traffic_logs DROP CONSTRAINT traffic_logs_status_check; 
    END IF; 
END $$;

-- 4. Adicionar coluna prioridade
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media';

-- 5. Comentários
COMMENT ON COLUMN public.traffic_logs.link_criativo IS 'Link para o criativo (Canva, Drive, etc)';
