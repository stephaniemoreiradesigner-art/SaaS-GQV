-- Tabela de Tarefas
CREATE TABLE IF NOT EXISTS public.tarefas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT,
    status TEXT DEFAULT 'pendente', -- pendente, em_andamento, concluida, solicitacao_prazo
    prazo_tipo TEXT CHECK (prazo_tipo IN ('para_dia', 'ate_dia')),
    prazo_data TIMESTAMP WITH TIME ZONE,
    tipo TEXT DEFAULT 'tarefa' CHECK (tipo IN ('tarefa', 'reuniao')),
    horario_reuniao TIME,
    criado_por UUID REFERENCES auth.users(id),
    cliente_id BIGINT REFERENCES public.clientes(id),
    time_id UUID REFERENCES public.times(id), -- Opcional, para filtro por time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela de Atribuições (Quem é responsável)
CREATE TABLE IF NOT EXISTS public.tarefa_atribuicoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE,
    usuario_email TEXT NOT NULL, -- Usando email para facilitar link com colaboradores
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela de Histórico/Comentários
CREATE TABLE IF NOT EXISTS public.tarefa_historico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id), -- Quem fez a ação
    tipo TEXT NOT NULL, -- 'criacao', 'atualizacao_status', 'comentario', 'solicitacao_prazo'
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefa_atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefa_historico ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Simplificadas para permitir operação inicial)
-- Idealmente: Admin/SuperAdmin vê tudo. Usuário vê apenas onde é atribuído ou do seu time.

-- Remover políticas antigas para evitar erro de duplicidade
DROP POLICY IF EXISTS "Acesso total a tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "Acesso total a atribuicoes" ON public.tarefa_atribuicoes;
DROP POLICY IF EXISTS "Acesso total a historico" ON public.tarefa_historico;

CREATE POLICY "Acesso total a tarefas" ON public.tarefas
    FOR ALL USING (public.is_tenant_match(cliente_id)) WITH CHECK (public.is_tenant_match(cliente_id));

CREATE POLICY "Acesso total a atribuicoes" ON public.tarefa_atribuicoes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tarefas t
            WHERE t.id = tarefa_atribuicoes.tarefa_id
            AND public.is_tenant_match(t.cliente_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tarefas t
            WHERE t.id = tarefa_atribuicoes.tarefa_id
            AND public.is_tenant_match(t.cliente_id)
        )
    );

CREATE POLICY "Acesso total a historico" ON public.tarefa_historico
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tarefas t
            WHERE t.id = tarefa_historico.tarefa_id
            AND public.is_tenant_match(t.cliente_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tarefas t
            WHERE t.id = tarefa_historico.tarefa_id
            AND public.is_tenant_match(t.cliente_id)
        )
    );
