-- Script Completo para Limpeza e Correção de Times e Colaboradores
-- Objetivo: Garantir estrutura correta e limpar dados fictícios antigos

-- 1. Adicionar colunas faltantes em Colaboradores (se ainda não existirem)
ALTER TABLE public.colaboradores 
ADD COLUMN IF NOT EXISTS permissoes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS times_acesso JSONB DEFAULT '[]';

-- 2. Garantir que a tabela Times existe com a estrutura correta
CREATE TABLE IF NOT EXISTS public.times (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilita RLS para Times
ALTER TABLE public.times ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acesso para Times
DO $$
BEGIN
    -- Leitura: Autenticados podem ler
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'times' AND policyname = 'Authenticated users can read times') THEN
        CREATE POLICY "Authenticated users can read times" ON public.times FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    
    -- Inserção: Autenticados podem inserir (idealmente apenas admins, mas para simplificar MVP deixamos autenticados)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'times' AND policyname = 'Authenticated users can insert times') THEN
        CREATE POLICY "Authenticated users can insert times" ON public.times FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    -- Deleção: Autenticados podem deletar
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'times' AND policyname = 'Authenticated users can delete times') THEN
        CREATE POLICY "Authenticated users can delete times" ON public.times FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 5. LIMPEZA DE DADOS FICTÍCIOS (SQUADS INVENTADOS)
-- Remove times com nomes genéricos que podem ter sido criados automaticamente ou via script de teste
DELETE FROM public.times 
WHERE nome IN ('Squad Geral', 'Squad Marketing', 'Squad Tech', 'Squad Vendas', 'Squad Exemplo');

-- 6. Inserir Time Padrão "GQV" APENAS se a tabela estiver totalmente vazia
INSERT INTO public.times (nome, descricao)
SELECT 'GQV', 'Time Principal'
WHERE NOT EXISTS (SELECT 1 FROM public.times);

-- 7. Atualizar colaboradores antigos para ter array vazio se for null
UPDATE public.colaboradores 
SET permissoes = '{}' 
WHERE permissoes IS NULL;

UPDATE public.colaboradores 
SET times_acesso = '[]'::jsonb 
WHERE times_acesso IS NULL;
