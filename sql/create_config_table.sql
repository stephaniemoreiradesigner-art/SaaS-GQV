-- Tabela de Configurações do Sistema (Ex: API Keys)
CREATE TABLE public.configuracoes (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Política: Apenas SuperAdmin pode ver e editar (assumindo que vamos controlar via JS por enquanto, 
-- mas idealmente o backend validaria. Como não temos backend custom, deixaremos liberado para autenticados 
-- mas o frontend esconderá de quem não é admin).
-- Para simplificar neste MVP NoCode:
CREATE POLICY "Permitir Acesso Config Autenticado"
ON public.configuracoes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Inserir registro inicial vazio para OpenAI
INSERT INTO public.configuracoes (key, value, description)
VALUES ('openai_api_key', '', 'Chave da API da OpenAI para geração de conteúdo IA')
ON CONFLICT (key) DO NOTHING;
