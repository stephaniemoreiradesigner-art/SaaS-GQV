-- Adicionar coluna post_id na tabela tarefas para vincular com social_posts
ALTER TABLE public.tarefas 
ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.social_posts(id);

-- Atualizar a função do trigger para incluir o post_id ao criar a tarefa
CREATE OR REPLACE FUNCTION public.handle_post_adjustment_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_tarefa_id UUID;
    v_cliente_nome TEXT;
BEGIN
    -- Se o status mudou para 'ajuste_solicitado'
    IF NEW.status = 'ajuste_solicitado' AND (OLD.status IS DISTINCT FROM 'ajuste_solicitado') THEN
        
        -- Buscar nome do cliente para a tarefa
        SELECT COALESCE(nome_empresa, nome_fantasia, 'Cliente') INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;

        -- 2.1 Criar Tarefa para o Time
        INSERT INTO public.tarefas (
            titulo,
            descricao,
            status,
            prazo_data,
            tipo,
            cliente_id,
            criado_por,
            post_id -- Novo campo
        ) VALUES (
            'Ajuste Solicitado: ' || NEW.tema,
            'O cliente solicitou ajustes no post de ' || to_char(NEW.data_agendada, 'DD/MM/YYYY') || '. Feedback: ' || COALESCE(NEW.feedback_cliente->>'comentario', 'Ver detalhes no post'),
            'pendente',
            NOW() + INTERVAL '1 day', -- Prazo de 24h
            'tarefa',
            NEW.cliente_id,
            NULL, -- Sistema
            NEW.id -- Vincula ao post
        ) RETURNING id INTO v_tarefa_id;

        -- 2.2 Criar Lembrete/Notificação
        INSERT INTO public.lembretes (
            titulo,
            concluido,
            user_id
        ) VALUES (
            '⚠️ Ajuste solicitado pelo cliente ' || COALESCE(v_cliente_nome, 'Desconhecido') || ' no post "' || NEW.tema || '"',
            false,
            NULL
        );

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
