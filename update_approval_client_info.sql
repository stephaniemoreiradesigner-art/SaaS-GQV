-- Função para obter informações do link de compartilhamento (Nome do Cliente, Datas)
CREATE OR REPLACE FUNCTION public.get_share_info(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_share_record RECORD;
    v_cliente_record RECORD;
BEGIN
    -- 1. Buscar dados do compartilhamento
    SELECT cliente_id, data_inicio, data_fim 
    INTO v_share_record
    FROM public.aprovacoes_share
    WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Link inválido.');
    END IF;

    -- 2. Buscar nome da empresa
    SELECT nome_empresa, responsavel_nome
    INTO v_cliente_record
    FROM public.clientes
    WHERE id = v_share_record.cliente_id;

    RETURN jsonb_build_object(
        'success', true,
        'cliente', v_cliente_record.nome_empresa,
        'responsavel', v_cliente_record.responsavel_nome,
        'data_inicio', v_share_record.data_inicio,
        'data_fim', v_share_record.data_fim
    );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.get_share_info(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_share_info(UUID) TO authenticated;
