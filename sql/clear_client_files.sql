-- Script para limpar os links de arquivos de TODOS os clientes
-- Isso permite testar o fluxo de upload do zero.

UPDATE public.clientes
SET 
    link_persona = NULL,
    link_referencias = NULL,
    link_identidade_visual = NULL,
    link_conteudos_anteriores = NULL;

-- Se quiser limpar de um cliente específico, use:
-- WHERE id = 'UUID_DO_CLIENTE';
