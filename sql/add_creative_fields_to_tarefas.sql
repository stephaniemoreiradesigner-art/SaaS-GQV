-- Adiciona colunas para o módulo de Solicitação de Criativos na tabela tarefas

ALTER TABLE public.tarefas 
ADD COLUMN IF NOT EXISTS copy_legenda text,
ADD COLUMN IF NOT EXISTS etapa_funil text,
ADD COLUMN IF NOT EXISTS link_arquivos text;

-- Comentários para documentação
COMMENT ON COLUMN public.tarefas.copy_legenda IS 'Instruções de copy ou legenda para o criativo';
COMMENT ON COLUMN public.tarefas.etapa_funil IS 'Etapa do funil (Topo, Meio, Fundo) para o criativo';
COMMENT ON COLUMN public.tarefas.link_arquivos IS 'Link para os arquivos finais do criativo (Drive, Dropbox, etc)';
