-- ESTRUTURA PARA GESTÃO DE TIMES E APROVAÇÃO EXTERNA

-- 1. Tabela de Times (Squads)
CREATE TABLE IF NOT EXISTS public.times (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Vincular Clientes a Times
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS time_id UUID REFERENCES public.times(id);

-- 3. Vincular Colaboradores a Times (Array de IDs dos times que ele pode acessar)
ALTER TABLE public.colaboradores
ADD COLUMN IF NOT EXISTS times_acesso JSONB DEFAULT '[]'; -- Ex: ["uuid-time-1", "uuid-time-2"]

-- 4. Tabela para Links de Aprovação Compartilhados
CREATE TABLE IF NOT EXISTS public.aprovacoes_share (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token UUID DEFAULT gen_random_uuid() NOT NULL, -- Token único para acesso público
    cliente_id BIGINT REFERENCES public.clientes(id) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status TEXT DEFAULT 'aguardando', -- aguardando, revisado, concluido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Política de Segurança (RLS) para Aprovacoes Share
-- Permitir leitura pública (anon) se tiver o token (será filtrado na query)
ALTER TABLE public.aprovacoes_share ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público via token" ON public.aprovacoes_share
    FOR SELECT
    USING (true); -- A filtragem real será feita pela aplicação buscando pelo token exato

-- Permitir update público para mudar status (quando cliente finaliza)
CREATE POLICY "Atualização pública via token" ON public.aprovacoes_share
    FOR UPDATE
    USING (true);

-- 6. Garantir que posts possam ser lidos publicamente SE estiverem em um link de aprovação válido
-- (Isso é complexo com RLS puro, faremos a segurança via Application Logic na página externa ou Function)
-- Por enquanto, vamos permitir leitura pública de posts para facilitar o MVP da página externa,
-- mas num cenário real restringiríamos mais.
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de posts" ON public.social_media_posts
    FOR SELECT
    USING (true); 

-- Atualizar Permissões de Leitura para tabelas novas
GRANT ALL ON public.times TO authenticated;
GRANT ALL ON public.times TO anon;
GRANT ALL ON public.aprovacoes_share TO authenticated;
GRANT ALL ON public.aprovacoes_share TO anon;
