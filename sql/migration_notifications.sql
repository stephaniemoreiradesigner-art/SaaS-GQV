-- Migration for Notifications and Trigger
-- 1. Ensure lembretes has user_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lembretes' AND column_name = 'user_id') THEN
        ALTER TABLE public.lembretes ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Trigger for Task Notifications
CREATE OR REPLACE FUNCTION notify_task_status_change() RETURNS TRIGGER AS $$
DECLARE
    assigner_id UUID;
    task_title TEXT;
    new_status TEXT;
    msg TEXT;
BEGIN
    -- Only proceed if status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        assigner_id := NEW.criado_por;
        task_title := NEW.titulo;
        new_status := NEW.status;
        
        -- Only notify if there is an assigner (criado_por is not null) and it's not the user themselves (optional, but good practice)
        -- Ideally we check auth.uid() but triggers run with security definer usually. 
        -- For now, notify regardless of who changed it, as long as there is an assigner.
        
        IF assigner_id IS NOT NULL THEN
            IF new_status = 'em_andamento' THEN
                msg := 'A tarefa "' || task_title || '" está em andamento.';
            ELSIF new_status = 'concluida' OR new_status = 'concluido' THEN
                msg := 'A tarefa "' || task_title || '" foi concluída.';
            ELSIF new_status = 'solicitacao_prazo' THEN
                msg := 'Solicitação de prazo para a tarefa "' || task_title || '".';
            END IF;

            IF msg IS NOT NULL THEN
                INSERT INTO public.lembretes (titulo, concluido, user_id)
                VALUES (msg, false, assigner_id);
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_task_status ON public.tarefas;

CREATE TRIGGER trigger_notify_task_status
AFTER UPDATE ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION notify_task_status_change();
