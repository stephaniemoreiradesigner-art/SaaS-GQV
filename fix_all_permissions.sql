-- 1. CORREÇÃO DE PERMISSÕES GERAIS (Tabelas e Storage)

-- Habilita RLS nas tabelas (se ainda não estiver)
ALTER TABLE IF EXISTS public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clientes_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.configuracoes ENABLE ROW LEVEL SECURITY;

-- REMOVE POLÍTICAS ANTIGAS (Limpeza)
DROP POLICY IF EXISTS "Acesso Total Clientes" ON public.clientes;
DROP POLICY IF EXISTS "Acesso Total Personas" ON public.clientes_personas;
DROP POLICY IF EXISTS "Acesso Total Posts" ON public.social_media_posts;
DROP POLICY IF EXISTS "Acesso Total Configuracoes" ON public.configuracoes;

-- CRIA POLÍTICAS PERMISSIVAS (Para evitar bloqueios "não está carregando")
-- (Em produção, você pode restringir mais, mas agora queremos que funcione)

-- Tabela Clientes
CREATE POLICY "Acesso Total Clientes" ON public.clientes
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela Personas
CREATE POLICY "Acesso Total Personas" ON public.clientes_personas
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela Posts
CREATE POLICY "Acesso Total Posts" ON public.social_media_posts
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela Configurações (Importante para API Keys)
CREATE POLICY "Acesso Total Configuracoes" ON public.configuracoes
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. CORREÇÃO DO STORAGE (Arquivos PDF)
INSERT INTO storage.buckets (id, name, public)
VALUES ('personas', 'personas', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Acesso Total Storage Personas" ON storage.objects;

CREATE POLICY "Acesso Total Storage Personas"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'personas')
WITH CHECK (bucket_id = 'personas');
