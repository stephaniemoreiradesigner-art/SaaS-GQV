-- Adiciona coluna prazo_solicitado na tabela tarefas
ALTER TABLE public.tarefas 
ADD COLUMN IF NOT EXISTS prazo_solicitado timestamp with time zone;

COMMENT ON COLUMN public.tarefas.prazo_solicitado IS 'Data de prazo solicitada pelo Social Media para aprovação do gestor';
