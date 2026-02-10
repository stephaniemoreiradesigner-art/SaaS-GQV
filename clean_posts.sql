-- Script para limpar posts e tarefas vinculadas
-- Isso excluirá todas as tarefas que são originadas de posts (calendário editorial)
DELETE FROM public.tarefas WHERE post_id IS NOT NULL;

-- Isso excluirá todos os posts (se houver CASCADE configurado, isso também limparia as tarefas, mas o comando acima garante)
DELETE FROM public.social_posts;
