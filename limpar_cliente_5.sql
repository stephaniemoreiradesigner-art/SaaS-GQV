-- Limpeza TOTAL para o Cliente ID 5
-- Isso vai remover todos os calendários, posts e resetar os links de arquivos deste cliente específico.

-- 1. Remover Posts dos calendários do cliente 5
DELETE FROM public.social_posts 
WHERE calendar_id IN (
    SELECT id FROM public.social_calendars 
    WHERE cliente_id = 5
);

-- 2. Remover os Calendários do cliente 5
DELETE FROM public.social_calendars 
WHERE cliente_id = 5;

-- 3. Resetar os links de arquivos no cadastro do cliente 5
UPDATE public.clientes 
SET 
    link_persona = NULL, 
    link_referencias = NULL, 
    link_identidade_visual = NULL, 
    link_conteudos_anteriores = NULL
WHERE id = 5;

-- Confirmação
SELECT 'Limpeza concluída para o Cliente ID 5' as status;
