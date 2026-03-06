-- Script corrigido para limpar TODOS os dados de calendário (posts e calendários) de um cliente específico
-- e resetar os links de arquivos (persona, referências, identidade).

-- 1. Remover Posts associados aos calendários desse cliente
-- Nota: A tabela clientes usa a coluna 'nome'
DELETE FROM social_posts 
WHERE calendar_id IN (
    SELECT id FROM social_calendars 
    WHERE cliente_id IN (
        SELECT id FROM clientes 
        WHERE nome ILIKE '%New Project%' OR nome ILIKE '%NP2%'
    )
);

-- 2. Remover os Calendários (de todos os meses)
DELETE FROM social_calendars 
WHERE cliente_id IN (
    SELECT id FROM clientes 
    WHERE nome ILIKE '%New Project%' OR nome ILIKE '%NP2%'
);

-- 3. Limpar os links de arquivos salvos na tabela de Clientes
-- Correção: Garantindo que estamos referenciando a tabela public.clientes corretamente
UPDATE public.clientes 
SET 
    link_persona = NULL, 
    link_referencias = NULL, 
    link_identidade_visual = NULL, 
    link_conteudos_anteriores = NULL
WHERE nome ILIKE '%New Project%' OR nome ILIKE '%NP2%';

-- Confirmação
SELECT 'Dados limpos com sucesso para clientes contendo NP2 ou New Project' as status;
