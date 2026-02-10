-- 1. Garante que a tabela existe
CREATE TABLE IF NOT EXISTS public.lembretes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    concluido BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Adiciona coluna user_id se não existir (para tornar os lembretes pessoais)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lembretes' AND column_name = 'user_id') THEN
        ALTER TABLE public.lembretes ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 3. Habilitar RLS
ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas para recriar corretamente
DROP POLICY IF EXISTS "Acesso Total Lembretes" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Pessoais" ON public.lembretes;

-- 5. Criar política de privacidade (Cada um vê apenas o seu)
CREATE POLICY "Lembretes Pessoais" ON public.lembretes
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL) -- user_id NULL (legado) visível a todos ou migrar? Vamos assumir NULL como público ou migrar.
    WITH CHECK (auth.uid() = user_id);

-- Opcional: Migrar lembretes sem dono para o usuário atual (se rodado via SQL Editor com user context, mas aqui é admin)
-- DELETE FROM public.lembretes WHERE user_id IS NULL; -- Limpeza opcional
