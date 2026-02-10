-- ==============================================================================
-- SETUP FINAL DA APROVAÇÃO DE POSTS (VibeCode)
-- ==============================================================================
-- Este script garante que todas as tabelas e funções necessárias para a 
-- funcionalidade de "Link de Aprovação" funcionem corretamente.
-- ==============================================================================

-- 1. Tabela para os Links de Compartilhamento (Segurança via Token)
CREATE TABLE IF NOT EXISTS public.aprovacoes_share (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token UUID DEFAULT gen_random_uuid() NOT NULL, -- O "segredo" da URL
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status TEXT DEFAULT 'aguardando', -- aguardando, revisado, concluido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Atualizar a tabela de Posts com campos ricos (se ainda não existirem)
ALTER TABLE public.social_media_posts
ADD COLUMN IF NOT EXISTS titulo TEXT,
ADD COLUMN IF NOT EXISTS detalhes_conteudo TEXT, -- JSON ou Texto com roteiro/slides
ADD COLUMN IF NOT EXISTS sugestao_criativo TEXT,
ADD COLUMN IF NOT EXISTS plataformas TEXT,
ADD COLUMN IF NOT EXISTS horario_post TEXT,
ADD COLUMN IF NOT EXISTS status_criativo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS arquivo_criativo_url TEXT,
ADD COLUMN IF NOT EXISTS link_drive TEXT,
ADD COLUMN IF NOT EXISTS feedback_cliente TEXT,
ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMP WITH TIME ZONE;

-- 3. Habilitar RLS (Segurança) na tabela de aprovações
ALTER TABLE public.aprovacoes_share ENABLE ROW LEVEL SECURITY;

-- Permitir que usuários logados criem links
DROP POLICY IF EXISTS "Permitir tudo para autenticados em aprovacoes_share" ON public.aprovacoes_share;
CREATE POLICY "Permitir tudo para autenticados em aprovacoes_share" 
ON public.aprovacoes_share FOR ALL TO authenticated USING (true);

-- Permitir leitura PÚBLICA (anon) apenas se souber o TOKEN (via RPC é mais seguro, mas RLS ajuda)
-- Na verdade, o acesso público será feito 100% via RPC com SECURITY DEFINER para máxima segurança.
-- Então não precisamos dar GRANT SELECT na tabela para anon.

-- 4. Função Mágica 1: Ler posts usando o Token (Sem login!)
CREATE OR REPLACE FUNCTION public.get_posts_via_share(p_token UUID)
RETURNS SETOF public.social_media_posts
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões de admin (ignora RLS do user anonimo)
AS $$
DECLARE
    v_cliente_id BIGINT;
    v_data_inicio DATE;
    v_data_fim DATE;
BEGIN
    -- Verificar se o token existe
    SELECT cliente_id, data_inicio, data_fim 
    INTO v_cliente_id, v_data_inicio, v_data_fim
    FROM public.aprovacoes_share
    WHERE token = p_token;

    -- Se não achar, retorna vazio
    IF v_cliente_id IS NULL THEN
        RETURN;
    END IF;

    -- Retornar os posts do cliente dentro da data
    RETURN QUERY
    SELECT *
    FROM public.social_media_posts
    WHERE cliente_id = v_cliente_id
    AND data_post BETWEEN v_data_inicio AND v_data_fim
    ORDER BY data_post ASC;
END;
$$;

-- 5. Função Mágica 2: Cliente aprova ou pede ajuste (Sem login!)
CREATE OR REPLACE FUNCTION public.atualizar_post_via_share(
    p_token UUID,
    p_post_id UUID,  -- ID do post agora é UUID
    p_status TEXT,
    p_feedback TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_share_record RECORD;
    v_post_record RECORD;
BEGIN
    -- 1. Validar Token
    SELECT * INTO v_share_record
    FROM public.aprovacoes_share
    WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Link inválido ou expirado.');
    END IF;

    -- 2. Validar se o Post pertence ao Cliente do Token (Segurança Crucial!)
    SELECT * INTO v_post_record
    FROM public.social_media_posts
    WHERE id = p_post_id
    AND cliente_id = v_share_record.cliente_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Post não encontrado ou não pertence a este link.');
    END IF;

    -- 3. Atualizar o Post
    UPDATE public.social_media_posts
    SET 
        status = p_status,
        feedback_cliente = p_feedback,
        data_aprovacao = CASE WHEN p_status = 'aprovado' THEN NOW() ELSE NULL END
    WHERE id = p_post_id;

    RETURN jsonb_build_object('success', true, 'message', 'Post atualizado com sucesso.');
END;
$$;

-- 6. Garantir permissões para o usuário anônimo (público) executar as funções RPC
GRANT EXECUTE ON FUNCTION public.get_posts_via_share(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.atualizar_post_via_share(UUID, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_posts_via_share(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_post_via_share(UUID, UUID, TEXT, TEXT) TO authenticated;
