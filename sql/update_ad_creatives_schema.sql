-- Adiciona novos campos na tabela ad_creatives para atender aos requisitos detalhados
ALTER TABLE public.ad_creatives 
ADD COLUMN IF NOT EXISTS numero_sequencial INT,
ADD COLUMN IF NOT EXISTS etapa_funil TEXT, -- Topo, Meio, Fundo
ADD COLUMN IF NOT EXISTS copy TEXT,
ADD COLUMN IF NOT EXISTS objetivo TEXT,
ADD COLUMN IF NOT EXISTS data_inicio DATE,
ADD COLUMN IF NOT EXISTS data_termino DATE,
ADD COLUMN IF NOT EXISTS principal_metrica TEXT,
ADD COLUMN IF NOT EXISTS resultado TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Atualiza o check de status se necessário (ou deixamos texto livre, mas vamos garantir que os novos status sejam aceitos)
-- O status original tinha: pendente, em_producao, concluido.
-- O usuário pediu: Ativo em Campanha, Inativo, Em Criação.
-- Vamos manter a coluna como TEXT para flexibilidade, mas vamos alinhar o front com esses novos status.
