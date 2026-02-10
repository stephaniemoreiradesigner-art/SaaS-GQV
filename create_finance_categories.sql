-- Tabela de Categorias Financeiras
CREATE TABLE IF NOT EXISTS public.categorias_financeiro (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    nome TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('entrada', 'saida', 'ambos')) DEFAULT 'ambos',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.categorias_financeiro ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
CREATE POLICY "Usuários podem ver suas próprias categorias" ON public.categorias_financeiro
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Usuários podem criar suas próprias categorias" ON public.categorias_financeiro
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias categorias" ON public.categorias_financeiro
    FOR DELETE USING (auth.uid() = user_id);

-- Inserir categorias padrão (opcional, para não começar vazio)
-- Nota: user_id NULL significa "categoria do sistema" visível para todos (conforme política acima "OR user_id IS NULL")
INSERT INTO public.categorias_financeiro (nome, tipo, user_id)
SELECT 'Serviços', 'entrada', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_financeiro WHERE nome = 'Serviços');

INSERT INTO public.categorias_financeiro (nome, tipo, user_id)
SELECT 'Consultoria', 'entrada', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_financeiro WHERE nome = 'Consultoria');

INSERT INTO public.categorias_financeiro (nome, tipo, user_id)
SELECT 'Ferramentas/Software', 'saida', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_financeiro WHERE nome = 'Ferramentas/Software');

INSERT INTO public.categorias_financeiro (nome, tipo, user_id)
SELECT 'Impostos', 'saida', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_financeiro WHERE nome = 'Impostos');

INSERT INTO public.categorias_financeiro (nome, tipo, user_id)
SELECT 'Pessoal', 'saida', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_financeiro WHERE nome = 'Pessoal');

INSERT INTO public.categorias_financeiro (nome, tipo, user_id)
SELECT 'Outros', 'ambos', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_financeiro WHERE nome = 'Outros');
