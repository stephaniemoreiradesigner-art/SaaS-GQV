-- Script de Correção Completa para Tabela ad_creatives
-- RODE ESTE SCRIPT NO "SQL EDITOR" DO SUPABASE

-- 1. Remove a tabela antiga para evitar conflitos
DROP TABLE IF EXISTS public.ad_creatives CASCADE;

-- 2. Cria a tabela novamente com TODAS as colunas necessárias
CREATE TABLE public.ad_creatives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Chave Estrangeira para Clientes (Importante: O tipo deve bater com o id da tabela clientes)
    -- Se clientes.id for INT8 (bigint), use BIGINT. Se for UUID, use UUID.
    -- Assumindo BIGINT pois é o padrão do Supabase para tabelas criadas via interface simples.
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,
    
    -- Campos de Texto
    titulo TEXT NOT NULL,
    formato TEXT DEFAULT 'Padrão',
    descricao TEXT,
    arquivo_url TEXT,
    
    -- Status e Controle
    status TEXT DEFAULT 'em_criacao',
    numero_sequencial INT DEFAULT 0,
    
    -- Campos Detalhados (Novos)
    etapa_funil TEXT,
    objetivo TEXT,
    copy TEXT,
    
    -- Datas
    data_inicio DATE,
    data_termino DATE,
    
    -- Métricas
    principal_metrica TEXT,
    resultado TEXT,
    observacoes TEXT
);

-- 3. Configura Permissões de Segurança (RLS)
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;

-- Permite que qualquer usuário logado faça tudo (leitura, escrita, edição, exclusão)
CREATE POLICY "Usuarios logados podem gerenciar criativos" 
ON public.ad_creatives 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 4. Insere um dado de teste (Opcional - só funciona se tiver um cliente com ID 1)
-- Se não tiver cliente com ID 1, isso vai dar erro, mas a tabela terá sido criada.
-- INSERT INTO public.ad_creatives (titulo, status, numero_sequencial, etapa_funil)
-- VALUES ('Criativo Teste Sistema', 'em_criacao', 1, 'topo');

-- Fim do Script
