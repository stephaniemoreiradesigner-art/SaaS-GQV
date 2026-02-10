-- Script Completo para garantir que o Diário de Bordo e a Integração com Tarefas funcionem

-- 1. Atualizar Tabela traffic_logs
DO $$ 
BEGIN 
    -- Solicitante
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'solicitante') THEN
        ALTER TABLE traffic_logs ADD COLUMN solicitante text;
    END IF;

    -- Prioridade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'prioridade') THEN
        ALTER TABLE traffic_logs ADD COLUMN prioridade text DEFAULT 'media';
    END IF;

    -- Ações Tomadas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'acoes_tomadas') THEN
        ALTER TABLE traffic_logs ADD COLUMN acoes_tomadas text;
    END IF;

    -- Prazo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'prazo') THEN
        ALTER TABLE traffic_logs ADD COLUMN prazo date;
    END IF;

    -- Tarefa ID (Vínculo)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'tarefa_id') THEN
        ALTER TABLE traffic_logs ADD COLUMN tarefa_id uuid REFERENCES tarefas(id);
    END IF;
END $$;

-- 2. Garantir coluna 'tipo' na tabela Tarefas (se ainda não existir)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tarefas' AND column_name = 'tipo') THEN
        ALTER TABLE tarefas ADD COLUMN tipo text DEFAULT 'geral';
    END IF;
END $$;
