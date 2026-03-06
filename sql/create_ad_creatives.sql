-- Tabela para Solicitação de Criativos de Anúncio
CREATE TABLE IF NOT EXISTS public.ad_creatives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT, -- Briefing
    formato TEXT, -- Feed, Story, Reels, etc.
    status TEXT DEFAULT 'pendente', -- pendente, em_producao, concluido
    arquivo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Acesso Total Ad Creatives Autenticado" 
ON public.ad_creatives 
FOR ALL 
TO authenticated 
USING (public.is_tenant_match(cliente_id)) 
WITH CHECK (public.is_tenant_match(cliente_id));

-- Bucket para Criativos (se não existir, cria logicamente via policies no bucket 'posts' ou novo)
-- Vamos usar o bucket 'posts' para simplificar, mas idealmente seria separado.
-- Se quisermos um bucket novo 'ad-creatives':
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-creatives', 'ad-creatives', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage
CREATE POLICY "Public View Ad Creatives"
ON storage.objects FOR SELECT
USING ( bucket_id = 'ad-creatives' );

CREATE POLICY "Authenticated Upload Ad Creatives"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'ad-creatives' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Update Ad Creatives"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'ad-creatives' AND auth.role() = 'authenticated' );
