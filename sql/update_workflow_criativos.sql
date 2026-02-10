-- Atualização para Workflow de Solicitação de Criativos

-- 1. Novos campos na tabela de tarefas
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS prazo_solicitado DATE;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS link_arquivos TEXT;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS etapa_funil TEXT;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS copy_legenda TEXT;

-- 2. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    link_destino TEXT -- ID da tarefa ou URL
);

-- 3. Políticas de Segurança (RLS) para Notificações
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas se existirem para evitar erro de duplicidade
DROP POLICY IF EXISTS "Usuários podem ver suas próprias notificações" ON notificacoes;
DROP POLICY IF EXISTS "Usuários podem criar notificações" ON notificacoes;
DROP POLICY IF EXISTS "Usuários podem atualizar suas notificações" ON notificacoes;

CREATE POLICY "Usuários podem ver suas próprias notificações"
    ON notificacoes FOR SELECT
    USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem criar notificações"
    ON notificacoes FOR INSERT
    WITH CHECK (true); 

CREATE POLICY "Usuários podem atualizar suas notificações"
    ON notificacoes FOR UPDATE
    USING (auth.uid() = usuario_id);
