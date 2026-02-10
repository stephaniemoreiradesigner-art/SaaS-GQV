-- Atualização da tabela traffic_logs para o novo Diário de Bordo

-- Adicionar colunas se não existirem
DO $$ 
BEGIN 
    -- Coluna: solicitante (texto)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'solicitante') THEN
        ALTER TABLE traffic_logs ADD COLUMN solicitante text;
    END IF;

    -- Coluna: prioridade (texto: alta, media, baixa)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'prioridade') THEN
        ALTER TABLE traffic_logs ADD COLUMN prioridade text DEFAULT 'media';
    END IF;

    -- Coluna: acoes_tomadas (texto longo)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'acoes_tomadas') THEN
        ALTER TABLE traffic_logs ADD COLUMN acoes_tomadas text;
    END IF;

    -- Coluna: prazo (data)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'prazo') THEN
        ALTER TABLE traffic_logs ADD COLUMN prazo date;
    END IF;

    -- Coluna: tarefa_id (para vincular à tarefa criada)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_logs' AND column_name = 'tarefa_id') THEN
        ALTER TABLE traffic_logs ADD COLUMN tarefa_id uuid REFERENCES tarefas(id);
    END IF;

    -- Renomear coluna 'descricao' para 'solicitacao' se desejado, ou manter 'descricao' e usar como solicitação no front.
    -- Vamos manter 'descricao' no banco para evitar quebras, mas no front será "Solicitação".
    -- Mas podemos adicionar um alias ou comentário se fosse SQL puro. Aqui apenas lembrete.

END $$;
