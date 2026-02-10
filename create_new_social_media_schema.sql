-- ==============================================================================
-- SCHEMA DO NOVO MÓDULO SOCIAL MEDIA (VibeCode)
-- ==============================================================================

-- 1. Tabela de Calendários (Agrupa os posts de um mês)
CREATE TABLE IF NOT EXISTS public.social_calendars (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    mes_referencia DATE NOT NULL, -- Ex: 2024-02-01 (Sempre dia 1 do mês)
    status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aguardando_aprovacao', 'aprovado', 'concluido')),
    
    -- Dados para a Landing Page de Aprovação
    share_token UUID DEFAULT gen_random_uuid(), -- Token único para link público
    access_password TEXT DEFAULT 'gqv123', -- Senha fixa inicial (pode ser alterada)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Posts (Cards do Kanban/Calendário)
CREATE TABLE IF NOT EXISTS public.social_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    calendar_id UUID REFERENCES public.social_calendars(id) ON DELETE CASCADE NOT NULL,
    
    data_agendada DATE NOT NULL,
    hora_agendada TIME DEFAULT '10:00',
    
    -- Conteúdo Principal
    tema TEXT NOT NULL,
    objetivo TEXT, -- Ex: Engajamento, Venda, Autoridade
    estrategia TEXT, -- Framework RETINA
    formato TEXT NOT NULL CHECK (formato IN ('estatico', 'reels', 'carrossel', 'stories')),
    
    -- Criativo
    legenda TEXT,
    cta TEXT,
    hashtags TEXT,
    imagem_url TEXT, -- Link da imagem gerada ou upload
    
    -- Status Individual
    status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aprovado', 'ajuste_solicitado', 'agendado', 'publicado')),
    feedback_ajuste TEXT, -- O que o cliente pediu para mudar
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS (Segurança)
ALTER TABLE public.social_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso (Simplificadas para MVP)
-- Permitir tudo para usuários autenticados (Equipe Interna)
CREATE POLICY "Equipe gerencia calendarios" ON public.social_calendars FOR ALL TO authenticated USING (true);
CREATE POLICY "Equipe gerencia posts" ON public.social_posts FOR ALL TO authenticated USING (true);

-- Permitir leitura pública para a LP de Aprovação (Via Edge Function ou Cliente Anonimo com Token)
-- Para simplificar, vamos deixar público APENAS LEITURA se tiver o token (lógica será no frontend/backend check)
-- Mas como o Supabase expõe API, melhor criar uma função RPC ou política específica se formos usar anon key.
-- Por enquanto, focamos no acesso autenticado da equipe.
