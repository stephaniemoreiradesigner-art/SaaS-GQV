-- Tabela para o novo Checklist de Tráfego
CREATE TABLE IF NOT EXISTS public.traffic_checklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    
    categoria TEXT NOT NULL, -- 'Tracking', 'LP', 'Criativos', 'Campanhas', 'Mensal'
    item TEXT NOT NULL, -- 'Pixel instalado', 'Eventos base', etc.
    
    prazo DATE,
    status TEXT DEFAULT 'a_fazer', -- 'a_fazer', 'em_andamento', 'acompanhando', 'concluido'
    
    observacoes TEXT
);

-- RLS Policies
ALTER TABLE public.traffic_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select checklist" 
ON public.traffic_checklist FOR SELECT 
USING (public.is_tenant_match(cliente_id));

CREATE POLICY "Authenticated users can insert checklist" 
ON public.traffic_checklist FOR INSERT 
WITH CHECK (public.is_tenant_match(cliente_id));

CREATE POLICY "Authenticated users can update checklist" 
ON public.traffic_checklist FOR UPDATE 
USING (public.is_tenant_match(cliente_id));

CREATE POLICY "Authenticated users can delete checklist" 
ON public.traffic_checklist FOR DELETE 
USING (public.is_tenant_match(cliente_id));
