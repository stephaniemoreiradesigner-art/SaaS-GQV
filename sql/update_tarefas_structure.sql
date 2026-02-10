
-- Adicionar colunas necessárias na tabela tarefas para suportar o fluxo de Solicitação de Criativos
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS link_arquivos TEXT;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS etapa_funil TEXT;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS copy_legenda TEXT;

-- Garantir que a tabela de atribuições existe (caso precise, mas vamos tentar usar direto se possível ou adaptar)
-- Se não existir tabela de notificações, criar para o sistema de push
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID REFERENCES auth.users(id),
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    link_destino TEXT
);
