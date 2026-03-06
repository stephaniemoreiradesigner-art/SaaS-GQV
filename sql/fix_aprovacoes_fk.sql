-- Script para corrigir erro de exclusão de clientes
-- Adiciona ON DELETE CASCADE na tabela aprovacoes_share

ALTER TABLE public.aprovacoes_share
DROP CONSTRAINT IF EXISTS aprovacoes_share_cliente_id_fkey;

ALTER TABLE public.aprovacoes_share
ADD CONSTRAINT aprovacoes_share_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Ajuste para permitir exclusão de clientes com tarefas vinculadas
ALTER TABLE public.tarefas
DROP CONSTRAINT IF EXISTS tarefas_cliente_id_fkey;

ALTER TABLE public.tarefas
ADD CONSTRAINT tarefas_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
