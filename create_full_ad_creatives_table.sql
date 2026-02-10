-- ==============================================================================
-- CRIAÇÃO DA TABELA AD_CREATIVES (Solicitações de Criativos) - COMPLETA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ad_creatives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Relacionamento com Cliente (Assumindo que clientes.id é BIGINT ou UUID, ajuste se necessário)
    -- Se der erro de tipo, verifique se clientes.id é int8 ou uuid. Aqui uso bigint como padrão comum.
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,
    
    -- Campos Básicos
    titulo TEXT NOT NULL,
    formato TEXT, -- 'imagem', 'video', 'carrossel'
    descricao TEXT, -- Briefing antigo
    arquivo_url TEXT, -- Link do arquivo final
    
    -- Status do Processo
    status TEXT DEFAULT 'em_criacao' CHECK (status IN ('pendente', 'em_producao', 'concluido', 'em_criacao', 'ativo', 'inativo')),
    
    -- Novos Campos de Gestão de Tráfego
    numero_sequencial INT, -- Para exibir #001, #002
    etapa_funil TEXT, -- 'topo', 'meio', 'fundo'
    objetivo TEXT, -- 'trafego', 'leads', 'vendas'
    copy TEXT, -- Texto do anúncio
    
    -- Datas
    data_inicio DATE,
    data_termino DATE,
    
    -- Performance (Preenchido depois)
    principal_metrica TEXT, -- 'cpa', 'ctr', 'roas'
    resultado TEXT, -- Valor alcançado
    observacoes TEXT -- Notas gerais
);

-- Habilitar segurança (RLS)
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;

-- Política de acesso (Simplificada: Logado pode tudo)
CREATE POLICY "Authenticated users can manage ad_creatives" 
ON public.ad_creatives 
FOR ALL 
USING (public.is_tenant_match(cliente_id))
WITH CHECK (public.is_tenant_match(cliente_id));

-- Comentários para documentação
COMMENT ON TABLE public.ad_creatives IS 'Tabela de solicitações e gestão de criativos de anúncios';
COMMENT ON COLUMN public.ad_creatives.numero_sequencial IS 'Número sequencial amigável por cliente (ex: Criativo #1)';
