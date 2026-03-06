-- Atualização da Tabela de Tarefas
ALTER TABLE public.tarefas 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'tarefa' CHECK (tipo IN ('tarefa', 'reuniao')),
ADD COLUMN IF NOT EXISTS horario_reuniao TIME;

-- Garantir que a tabela de atribuições suporte múltiplas pessoas (já suporta pois é uma tabela de relacionamento)
-- Garantir que status possa receber feedback
ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_status_check;
-- Recriando check se existir, ou deixando aberto (texto livre é mais flexível, mas vamos manter os padrões)
-- status: pendente, em_andamento, concluida, atrasada, solicitacao_prazo
-- Não precisa de alteração na estrutura se usarmos o campo 'status' para controlar o fluxo.

-- Adicionar campo de feedback/resposta na tabela de tarefas ou histórico?
-- Melhor no histórico. Já existe 'descricao'.
