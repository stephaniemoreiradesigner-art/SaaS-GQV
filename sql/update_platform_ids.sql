-- Adiciona colunas de ID de Conta de Anúncio na tabela de clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT,
ADD COLUMN IF NOT EXISTS google_ad_account_id TEXT,
ADD COLUMN IF NOT EXISTS tiktok_ad_account_id TEXT;

-- Adiciona coluna de plataforma na tabela de dados de relatório (se não existir)
ALTER TABLE public.traffic_reports_data 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta_ads';

-- Atualiza a tabela de logs de tráfego também, por precaução
ALTER TABLE public.traffic_logs 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta_ads';

-- Comentário: As tabelas agora suportam a distinção por plataforma e IDs específicos por cliente.
