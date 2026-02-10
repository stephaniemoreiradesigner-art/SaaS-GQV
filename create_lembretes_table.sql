-- Tabela de Lembretes do Dashboard
CREATE TABLE IF NOT EXISTS public.lembretes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    concluido BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

-- Política permissiva para MVP (todos os usuários autenticados podem ver/editar todos os lembretes)
-- Em produção, você pode querer filtrar por user_id se forem lembretes pessoais
DROP POLICY IF EXISTS "Acesso Total Lembretes" ON public.lembretes;

CREATE POLICY "Acesso Total Lembretes" ON public.lembretes
FOR ALL TO authenticated USING (true) WITH CHECK (true);
