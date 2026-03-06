-- 1. Adicionar coluna post_id na tabela tarefas (se não existir)
ALTER TABLE public.tarefas 
ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.social_posts(id);

-- 2. Permitir que o público ATUALIZE os posts (para aprovar/solicitar ajuste)
DROP POLICY IF EXISTS "Publico pode atualizar posts em aprovação" ON social_posts;

CREATE POLICY "Publico pode atualizar posts em aprovação"
ON social_posts
FOR UPDATE
TO public
USING (approval_group_id IS NOT NULL);

-- 3. Função para criar Tarefa e Notificação automaticamente quando solicitar ajuste
CREATE OR REPLACE FUNCTION public.handle_post_adjustment_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_nome TEXT;
    v_tarefa_id UUID;
BEGIN
    -- Só executa se o status mudou para 'ajuste_solicitado'
    IF NEW.status = 'ajuste_solicitado' AND OLD.status != 'ajuste_solicitado' THEN
        
        -- Buscar nome do cliente para a tarefa
        SELECT COALESCE(nome_empresa, nome_fantasia, 'Cliente') INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;
        
        -- 3.1 Criar Tarefa para o time
        INSERT INTO public.tarefas (
            titulo,
            descricao,
            status,
            prazo_data,
            tipo,
            cliente_id,
            criado_por,
            post_id -- Vínculo com o post
        ) VALUES (
            'Ajuste em Post: ' || NEW.tema,
            'O cliente solicitou ajustes no post de ' || to_char(NEW.data_agendada, 'DD/MM/YYYY') || '. Feedback: ' || COALESCE(NEW.feedback_cliente->>'comentario', 'Ver detalhes no post'),
            'pendente',
            NOW() + INTERVAL '1 day', -- Prazo de 24h
            'tarefa',
            NEW.cliente_id,
            NULL, -- Sistema
            NEW.id -- ID do Post
        ) RETURNING id INTO v_tarefa_id;

        -- 3.2 Criar Lembrete/Notificação
        INSERT INTO public.lembretes (
            titulo,
            concluido,
            user_id
        ) VALUES (
            '⚠️ Ajuste solicitado pelo cliente ' || COALESCE(v_cliente_nome, 'Desconhecido') || ' no post "' || NEW.tema || '"',
            false,
            NULL -- Visível para todos
        );

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar o Trigger
DROP TRIGGER IF EXISTS trigger_auto_create_adjustment_task ON social_posts;

CREATE TRIGGER trigger_auto_create_adjustment_task
AFTER UPDATE ON social_posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_post_adjustment_trigger();
