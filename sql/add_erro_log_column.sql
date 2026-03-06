-- Adiciona a coluna erro_log na tabela social_calendars
-- Essa coluna será usada para armazenar mensagens de erro vindas do n8n/IA
ALTER TABLE social_calendars 
ADD COLUMN erro_log TEXT;

-- (Opcional) Comentário na coluna para documentação
COMMENT ON COLUMN social_calendars.erro_log IS 'Armazena mensagens de erro caso o fluxo de geração falhe';
