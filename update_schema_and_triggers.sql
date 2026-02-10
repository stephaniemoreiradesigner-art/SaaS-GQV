-- 1. Atualizações de Schema

-- Adicionar post_id em tarefas
ALTER TABLE public.tarefas 
ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.social_posts(id);

-- Adicionar user_id em lembretes (para notificações direcionadas)
ALTER TABLE public.lembretes
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Atualizar Policies

-- Posts: Público pode atualizar (para aprovação)
DROP POLICY IF EXISTS "Publico pode atualizar posts em aprovação" ON social_posts;
CREATE POLICY "Publico pode atualizar posts em aprovação"
ON social_posts
FOR UPDATE
TO public
USING (approval_group_id IS NOT NULL);

-- Lembretes: Usuários podem ver seus próprios lembretes OU lembretes públicos (user_id IS NULL)
DROP POLICY IF EXISTS "Acesso Total Lembretes" ON public.lembretes;
CREATE POLICY "Ver Lembretes Proprios ou Publicos" ON public.lembretes
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Gerenciar Lembretes Proprios" ON public.lembretes
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);


-- 3. Trigger: Solicitação de Ajuste (Post -> Tarefa + Lembrete Geral)

CREATE OR REPLACE FUNCTION public.handle_post_adjustment_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_nome TEXT;
    v_tarefa_id UUID;
BEGIN
    IF NEW.status = 'ajuste_solicitado' AND OLD.status != 'ajuste_solicitado' THEN
        
        -- Buscar nome do cliente (ajustado para tentar nome_empresa ou nome_fantasia)
        SELECT COALESCE(nome_empresa, nome_fantasia, 'Cliente') INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;
        
        -- Criar Tarefa
        INSERT INTO public.tarefas (
            titulo,
            descricao,
            status,
            prazo_data,
            tipo,
            cliente_id,
            criado_por,
            post_id
        ) VALUES (
            'Ajuste em Post: ' || NEW.tema,
            'O cliente solicitou ajustes no post de ' || to_char(NEW.data_agendada, 'DD/MM/YYYY') || '. Feedback: ' || COALESCE(NEW.feedback_cliente->>'comentario', 'Ver detalhes no post'),
            'pendente',
            NOW() + INTERVAL '1 day',
            'tarefa',
            NEW.cliente_id,
            NULL, -- Sistema
            NEW.id
        ) RETURNING id INTO v_tarefa_id;

        -- Criar Lembrete Geral (user_id NULL)
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

DROP TRIGGER IF EXISTS trigger_auto_create_adjustment_task ON social_posts;
CREATE TRIGGER trigger_auto_create_adjustment_task
AFTER UPDATE ON social_posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_post_adjustment_trigger();


-- 4. Trigger: Notificação de Mudança de Status da Tarefa (Tarefa -> Lembrete para Criador)

CREATE OR REPLACE FUNCTION public.notify_task_creator_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_criador_id UUID;
    v_msg TEXT;
BEGIN
    -- Se status mudou E tem criador definido (e não é o sistema/NULL)
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.criado_por IS NOT NULL THEN
        v_criador_id := NEW.criado_por;
        
        -- Definir mensagem baseada no status
        IF NEW.status = 'em_andamento' THEN
            v_msg := '🚀 A tarefa "' || NEW.titulo || '" iniciou o andamento.';
        ELSIF NEW.status IN ('concluido', 'concluida') THEN
            v_msg := '✅ A tarefa "' || NEW.titulo || '" foi concluída.';
        -- Adicionar aqui lógica para "prazo solicitado" se houver campo para isso futuramente
        ELSE
            RETURN NEW; -- Ignorar outros status por enquanto
        END IF;

        -- Criar Lembrete para o Criador
        INSERT INTO public.lembretes (
            titulo,
            concluido,
            user_id
        ) VALUES (
            v_msg,
            false,
            v_criador_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_task_creator ON tarefas;
CREATE TRIGGER trigger_notify_task_creator
AFTER UPDATE ON tarefas
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_creator_on_status_change();
