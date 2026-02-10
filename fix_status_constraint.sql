-- Atualizar a constraint de status da tabela social_posts para permitir todos os status utilizados no sistema
ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;

ALTER TABLE public.social_posts 
ADD CONSTRAINT social_posts_status_check 
CHECK (status IN (
    'rascunho', 
    'pendente',               -- Pronto para envio (Amarelo)
    'pendente_aprovação',     -- Enviado ao cliente (Amarelo)
    'aprovado',               -- Aprovado pelo cliente (Verde)
    'ajuste_solicitado',      -- Cliente pediu alteração (Vermelho/Laranja)
    'ajuste_em_andamento',    -- Sendo corrigido (Laranja)
    'agendado',               -- Com data definida
    'publicado',              -- Já postado
    'concluido'               -- Finalizado
));
