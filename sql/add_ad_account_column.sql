-- Adicionar coluna para ID da Conta de Anúncios do Meta na tabela de clientes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'meta_ad_account_id') THEN
        ALTER TABLE public.clientes ADD COLUMN meta_ad_account_id text;
    END IF;
END $$;
