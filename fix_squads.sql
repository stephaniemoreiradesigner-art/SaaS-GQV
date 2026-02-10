-- Script para garantir funcionamento dos Squads (Times)
-- RODE ESTE SCRIPT NO EDITOR SQL DO SUPABASE

-- 1. Cria a tabela de Times se não existir
CREATE TABLE IF NOT EXISTS public.times (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilita RLS para Times
ALTER TABLE public.times ENABLE ROW LEVEL SECURITY;

-- 3. Cria políticas de acesso para Times (Leitura para autenticados)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'times' AND policyname = 'Authenticated users can read times') THEN
        CREATE POLICY "Authenticated users can read times" ON public.times FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'times' AND policyname = 'Authenticated users can insert times') THEN
        CREATE POLICY "Authenticated users can insert times" ON public.times FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'times' AND policyname = 'Authenticated users can delete times') THEN
        CREATE POLICY "Authenticated users can delete times" ON public.times FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 4. Adiciona coluna times_acesso em Colaboradores se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'colaboradores' AND column_name = 'times_acesso') THEN
        ALTER TABLE public.colaboradores ADD COLUMN times_acesso JSONB DEFAULT '[]';
    END IF;
END $$;

-- 5. Insere times padrão se a tabela estiver vazia
INSERT INTO public.times (nome, descricao)
SELECT 'Squad Geral', 'Time padrão para todos os projetos'
WHERE NOT EXISTS (SELECT 1 FROM public.times);

INSERT INTO public.times (nome, descricao)
SELECT 'Squad Marketing', 'Focado em Social Media e Tráfego'
WHERE NOT EXISTS (SELECT 1 FROM public.times WHERE nome = 'Squad Marketing');

INSERT INTO public.times (nome, descricao)
SELECT 'Squad Tech', 'Desenvolvimento e Automações'
WHERE NOT EXISTS (SELECT 1 FROM public.times WHERE nome = 'Squad Tech');
