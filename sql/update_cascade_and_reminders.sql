-- Script para adicionar CASCADE delete em tarefas e trigger de lembretes
-- 1. Adicionar CASCADE na foreign key post_id da tabela tarefas
-- Primeiro removemos a constraint existente se houver (para garantir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tarefas_post_id_fkey') THEN
        ALTER TABLE public.tarefas DROP CONSTRAINT tarefas_post_id_fkey;
    END IF;
END $$;

-- Adiciona a constraint com CASCADE
ALTER TABLE public.tarefas 
ADD CONSTRAINT tarefas_post_id_fkey 
FOREIGN KEY (post_id) 
REFERENCES public.social_posts(id) 
ON DELETE CASCADE;

-- 2. Garantir que updated_at seja atualizado automaticamente (caso não exista trigger)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Cria trigger se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_tarefas') THEN
        CREATE TRIGGER set_updated_at_tarefas
        BEFORE UPDATE ON public.tarefas
        FOR EACH ROW
        EXECUTE PROCEDURE public.handle_updated_at();
    END IF;
END $$;

-- 3. Trigger para apagar lembretes manuais associados (caso existam) ou limpar dashboard
-- O usuário pediu: "Quando a tarefa mudar para o status de concluída ela deve sumir automaticamente dos lembretes"
-- Se 'lembretes' se refere à tabela de lembretes manuais e houver um link (não padrão no código visto, mas por precaução)
-- Se não houver link, o dashboard.js cuida da visualização. 
-- Mas vamos garantir que se houver um lembrete vinculado à tarefa (campo tarefa_id), ele seja deletado.
-- Verificamos se a coluna tarefa_id existe na tabela lembretes antes de criar a trigger.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lembretes' AND column_name = 'tarefa_id') THEN
        -- Cria função para deletar lembrete ao concluir tarefa
        CREATE OR REPLACE FUNCTION public.auto_delete_reminder_on_task_finish()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.status IN ('concluido', 'concluida') AND OLD.status NOT IN ('concluido', 'concluida') THEN
                DELETE FROM public.lembretes WHERE tarefa_id = NEW.id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        -- Cria trigger
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_delete_reminder_on_task_finish') THEN
            CREATE TRIGGER trigger_delete_reminder_on_task_finish
            AFTER UPDATE ON public.tarefas
            FOR EACH ROW
            EXECUTE PROCEDURE public.auto_delete_reminder_on_task_finish();
        END IF;
    END IF;
END $$;
