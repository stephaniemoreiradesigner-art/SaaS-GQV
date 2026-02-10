-- Adicionar coluna 'tipo' na tabela tarefas se não existir
ALTER TABLE public.tarefas 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'tarefa' CHECK (tipo IN ('tarefa', 'reuniao'));

-- Adicionar coluna 'horario_reuniao' também, pois geralmente acompanha o tipo
ALTER TABLE public.tarefas 
ADD COLUMN IF NOT EXISTS horario_reuniao TIME;
