-- Script FINAL para corrigir o erro "Could not find column acoes_tomadas"
-- Execute este script no SQL Editor do Supabase para adicionar as colunas que faltam no Diário de Bordo.

DO $$ 
BEGIN 
    -- 1. Coluna: Ações Tomadas (O erro principal)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'acoes_tomadas') THEN
        ALTER TABLE public.traffic_logs ADD COLUMN acoes_tomadas text;
    END IF;

    -- 2. Coluna: Solicitante
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'solicitante') THEN
        ALTER TABLE public.traffic_logs ADD COLUMN solicitante text;
    END IF;

    -- 3. Coluna: Prioridade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'prioridade') THEN
        ALTER TABLE public.traffic_logs ADD COLUMN prioridade text DEFAULT 'media';
    END IF;

    -- 4. Coluna: Prazo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'prazo') THEN
        ALTER TABLE public.traffic_logs ADD COLUMN prazo date;
    END IF;

    -- 5. Coluna: Tarefa ID (Vínculo com Tarefas)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'tarefa_id') THEN
        ALTER TABLE public.traffic_logs ADD COLUMN tarefa_id uuid REFERENCES public.tarefas(id);
    END IF;

    -- 6. Garantir permissões (só por segurança)
    GRANT ALL ON public.traffic_logs TO authenticated;
    GRANT ALL ON public.traffic_logs TO service_role;

END $$;
