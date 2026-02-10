-- ==============================================================================
-- TABELA DIÁRIO DE BORDO (Logs de Alterações)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.traffic_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relacionamento
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    
    -- Dados do Registro
    data_log DATE DEFAULT CURRENT_DATE,
    tipo_alteracao TEXT NOT NULL CHECK (tipo_alteracao IN ('otimizacao', 'criacao', 'pausa', 'escala', 'analise', 'outro')),
    descricao TEXT NOT NULL,
    
    -- Responsável (Opcional, pega do auth se quiser implementar depois)
    responsavel TEXT 
);

-- RLS
ALTER TABLE public.traffic_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage traffic_logs" 
ON public.traffic_logs 
FOR ALL 
USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.traffic_logs IS 'Histórico de alterações e otimizações nas contas de tráfego';
