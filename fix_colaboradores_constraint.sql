-- Remover a constraint antiga que está bloqueando 'super_admin'
ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS colaboradores_perfil_acesso_check;

-- Adicionar nova constraint com os valores corretos (incluindo super_admin)
ALTER TABLE public.colaboradores 
ADD CONSTRAINT colaboradores_perfil_acesso_check 
CHECK (perfil_acesso IN ('usuario', 'admin', 'super_admin'));
