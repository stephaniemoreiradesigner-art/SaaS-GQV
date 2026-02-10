-- Adicionar coluna para Link de Diretrizes na tabela Clientes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS diretrizes_link TEXT;

-- (Opcional) Se quisermos garantir que apenas admins editem, usaríamos RLS,
-- mas como a lógica de negócio está no front por enquanto (MVP), 
-- vamos controlar a UI via JS e deixar o RLS padrão (authenticated pode update).
