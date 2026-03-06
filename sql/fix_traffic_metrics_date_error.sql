-- CORREÇÃO DE ERRO: null value in column "data_metric"
-- Este script ajusta a tabela traffic_metrics para aceitar valores nulos ou usar a data de hoje como padrão.

DO $$
BEGIN
    -- 1. Verifica o tipo da coluna para definir o DEFAULT correto
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'data_metric' AND data_type = 'text') THEN
        -- Se for TEXTO, define o padrão como a data de hoje em formato texto 'YYYY-MM-DD'
        ALTER TABLE public.traffic_metrics ALTER COLUMN data_metric SET DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
    ELSE
        -- Se for DATE, define o padrão como CURRENT_DATE
        ALTER TABLE public.traffic_metrics ALTER COLUMN data_metric SET DEFAULT CURRENT_DATE;
    END IF;

    -- 2. Remove a restrição NOT NULL (Obrigatório)
    -- Isso impede que a automação quebre se o campo vier vazio
    ALTER TABLE public.traffic_metrics ALTER COLUMN data_metric DROP NOT NULL;
    
    -- Aproveitando para garantir que data_metric_fim também não quebre
    ALTER TABLE public.traffic_metrics ALTER COLUMN data_metric_fim DROP NOT NULL;

END $$;
