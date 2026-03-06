CREATE TABLE IF NOT EXISTS public.traffic_checklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    categoria TEXT, -- 'Tracking', 'LP', 'Criativos', 'Campanhas', 'Mensal'
    item TEXT, -- 'Pixel instalado', 'Eventos base', 'Debug validado', 'Velocidade testada', 'Responsividade', 'CTA funcional', 'Criativos aprovados', 'Variações criativas', 'Nomeclatura padrão', 'Públicos validados', 'Relatório entregue'
    prazo DATE,
    status TEXT DEFAULT 'a_fazer', -- 'a_fazer', 'em_andamento', 'acompanhando', 'concluido'
    observacoes TEXT
);

-- RLS
ALTER TABLE public.traffic_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage checklist" ON public.traffic_checklist;

CREATE POLICY "Users can manage checklist" ON public.traffic_checklist
    FOR ALL USING (auth.role() = 'authenticated');
