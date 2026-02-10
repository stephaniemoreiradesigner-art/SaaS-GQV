-- ==============================================================================
-- MÓDULO CHAT DA EQUIPE (VibeCode)
-- ==============================================================================

-- 1. Tabela de Canais (Channels)
CREATE TABLE IF NOT EXISTS public.chat_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT, -- Pode ser null para DMs
    type TEXT NOT NULL CHECK (type IN ('public', 'private', 'direct')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Membros do Canal
CREATE TABLE IF NOT EXISTS public.chat_members (
    channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

-- 3. Tabela de Mensagens
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id), -- Autor
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Chat Channels
-- Public: Todos podem ver
CREATE POLICY "Ver canais publicos" ON public.chat_channels
    FOR SELECT USING (type = 'public');

-- Private/Direct: Apenas membros podem ver (precisa de subquery ou policy em members)
-- Para simplificar a criação, vamos permitir insert para autenticados
CREATE POLICY "Criar canais" ON public.chat_channels
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Ver canais onde sou membro (para private/direct)
CREATE POLICY "Ver canais membro" ON public.chat_channels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_members 
            WHERE channel_id = chat_channels.id 
            AND user_id = auth.uid()
        )
    );

-- Chat Members
-- Ver membros dos canais que tenho acesso
CREATE POLICY "Ver membros" ON public.chat_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_members as cm
            WHERE cm.channel_id = chat_members.channel_id 
            AND cm.user_id = auth.uid()
        ) 
        OR 
        EXISTS (
            SELECT 1 FROM public.chat_channels 
            WHERE id = chat_members.channel_id 
            AND type = 'public'
        )
    );

-- Adicionar membros (auto-join em publicos ou invite em privados)
CREATE POLICY "Gerenciar membros" ON public.chat_members
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Chat Messages
-- Ver mensagens de canais que sou membro ou públicos
CREATE POLICY "Ver mensagens" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_channels 
            WHERE id = chat_messages.channel_id 
            AND type = 'public'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.chat_members 
            WHERE channel_id = chat_messages.channel_id 
            AND user_id = auth.uid()
        )
    );

-- Enviar mensagens
CREATE POLICY "Enviar mensagens" ON public.chat_messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- INSERIR CANAL PADRÃO #GERAL SE NÃO EXISTIR
INSERT INTO public.chat_channels (name, type)
SELECT 'Geral', 'public'
WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels WHERE name = 'Geral');
