-- ==============================================================================
-- TABELA CHECKLIST / TAREFAS DE TRÁFEGO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.traffic_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    
    descricao TEXT NOT NULL, -- O que precisa ser feito
    concluido BOOLEAN DEFAULT FALSE, -- Checkbox
    
    prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
    data_vencimento DATE, -- Opcional
    
    categoria TEXT -- 'diario', 'semanal', 'mensal', 'setup'
);

-- RLS
ALTER TABLE public.traffic_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage tasks" 
ON public.traffic_tasks 
FOR ALL 
USING (auth.role() = 'authenticated');
