
-- 1. Alterar a constraint para permitir que o post seja deletado e a tarefa apenas perca o vínculo (SET NULL)
-- Isso evita erros de "violates foreign key constraint" se houver.
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Loop para encontrar e dropar qualquer FK de tarefas para social_posts (caso o nome não seja padrão)
    FOR r IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'tarefas'
          AND kcu.column_name = 'post_id'
          AND ccu.table_name = 'social_posts'
    ) LOOP
        EXECUTE 'ALTER TABLE public.tarefas DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Recriar a constraint com ON DELETE SET NULL
ALTER TABLE public.tarefas
ADD CONSTRAINT fk_tarefas_social_posts
FOREIGN KEY (post_id)
REFERENCES public.social_posts(id)
ON DELETE SET NULL;


-- 2. Criar Trigger para tratar as tarefas quando o post é excluído (Desvincular e Concluir)
CREATE OR REPLACE FUNCTION public.handle_deleted_post_tasks()
RETURNS TRIGGER AS $$
BEGIN
    -- Antes de deletar o post, atualiza as tarefas vinculadas
    -- Define status como 'concluido' para sair das pendências
    -- Adiciona nota no histórico/descrição
    -- O post_id será setado como NULL automaticamente pela FK ou podemos fazer aqui
    
    UPDATE public.tarefas
    SET 
        status = 'concluido',
        descricao = COALESCE(descricao, '') || E'\n\n[SISTEMA] O calendário/post vinculado foi excluído. Tarefa concluída automaticamente.',
        updated_at = NOW()
    WHERE post_id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger deve rodar ANTES do delete para pegar as tarefas ainda vinculadas
DROP TRIGGER IF EXISTS trigger_handle_deleted_post ON public.social_posts;
CREATE TRIGGER trigger_handle_deleted_post
BEFORE DELETE ON public.social_posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_deleted_post_tasks();

-- 3. Limpeza Retroativa: Corrigir tarefas que já estão "presas" (órfãs de posts excluídos anteriormente)
UPDATE public.tarefas
SET 
    status = 'concluido',
    descricao = COALESCE(descricao, '') || E'\n\n[SISTEMA] Correção automática: O post vinculado não existe mais.',
    post_id = NULL,
    updated_at = NOW()
WHERE post_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.social_posts WHERE id = tarefas.post_id);

