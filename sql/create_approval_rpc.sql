-- Remove versões antigas para evitar conflito de assinatura (overload)
DROP FUNCTION IF EXISTS public.atualizar_post_via_share(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.atualizar_post_via_share(UUID, UUID, TEXT, TEXT);

-- Função RPC para ATUALIZAR post via link público (Seguro)
CREATE OR REPLACE FUNCTION public.atualizar_post_via_share(
    p_token UUID,
    p_post_id UUID, 
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

    -- 2. Validar Post
    SELECT * INTO v_post_record
    FROM public.social_media_posts
    WHERE id = p_post_id
    AND cliente_id = v_share_record.cliente_id
    AND data_post BETWEEN v_share_record.data_inicio AND v_share_record.data_fim;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Post não encontrado.');
    END IF;

    -- 3. Atualizar
    UPDATE public.social_media_posts
    SET 
        status = p_status,
        feedback_cliente = p_feedback,
        data_aprovacao = CASE WHEN p_status = 'aprovado' THEN NOW() ELSE NULL END
    WHERE id = p_post_id;

    BEGIN
        IF p_status = 'ajustes' THEN
            INSERT INTO public.social_media_events (cliente_id, post_id, share_id, event_type, meta)
            VALUES (
                v_share_record.cliente_id,
                p_post_id,
                v_share_record.id,
                'ajuste_solicitado',
                jsonb_build_object('via', 'share')
            );
        ELSIF p_status = 'aprovado' THEN
            IF v_post_record.status = 'ajustes' THEN
                INSERT INTO public.social_media_events (cliente_id, post_id, share_id, event_type, meta)
                VALUES (
                    v_share_record.cliente_id,
                    p_post_id,
                    v_share_record.id,
                    'post_ajustado_aprovado',
                    jsonb_build_object('via', 'share')
                );
            ELSE
                INSERT INTO public.social_media_events (cliente_id, post_id, share_id, event_type, meta)
                VALUES (
                    v_share_record.cliente_id,
                    p_post_id,
                    v_share_record.id,
                    'post_aprovado_agendado',
                    jsonb_build_object('via', 'share')
                );
            END IF;
        END IF;
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    RETURN jsonb_build_object('success', true, 'message', 'Post atualizado.');
END;
$$;

-- Função RPC para LER posts via link público (Seguro)
CREATE OR REPLACE FUNCTION public.get_posts_via_share(p_token UUID)
RETURNS SETOF public.social_media_posts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id BIGINT;
    v_data_inicio DATE;
    v_data_fim DATE;
BEGIN
    SELECT cliente_id, data_inicio, data_fim INTO v_cliente_id, v_data_inicio, v_data_fim
    FROM public.aprovacoes_share
    WHERE token = p_token;

    IF v_cliente_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.social_media_posts
    WHERE cliente_id = v_cliente_id
    AND data_post BETWEEN v_data_inicio AND v_data_fim
    ORDER BY data_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_posts_via_share(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_posts_via_share(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.atualizar_post_via_share(UUID, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.atualizar_post_via_share(UUID, UUID, TEXT, TEXT) TO authenticated;
