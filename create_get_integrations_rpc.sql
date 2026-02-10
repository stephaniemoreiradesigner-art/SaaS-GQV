CREATE OR REPLACE FUNCTION public.get_client_integrations_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id INT8;
    v_result JSONB;
BEGIN
    -- Validar token e pegar cliente_id
    SELECT cliente_id INTO v_cliente_id
    FROM public.aprovacoes_share
    WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Token inválido ou expirado');
    END IF;

    -- Buscar tokens
    SELECT jsonb_build_object(
        'facebook_page_id', facebook_page_id,
        'facebook_page_token', facebook_page_token,
        'linkedin_id', linkedin_id,
        'linkedin_token', linkedin_token,
        'tiktok_id', tiktok_id,
        'tiktok_token', tiktok_token
    ) INTO v_result
    FROM public.clientes
    WHERE id = v_cliente_id;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_integrations_by_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_client_integrations_by_token(UUID) TO authenticated;
