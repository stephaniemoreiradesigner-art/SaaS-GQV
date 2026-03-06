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

ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.clientes(id);
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS tipo TEXT;

CREATE OR REPLACE FUNCTION public.set_lembretes_defaults()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id BIGINT;
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by = auth.uid();
    END IF;

    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
        NEW.tenant_id = v_tenant_id;
    END IF;

    IF NEW.tipo IS NULL THEN
        NEW.tipo = 'manual';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_lembretes_defaults ON public.lembretes;
CREATE TRIGGER set_lembretes_defaults
BEFORE INSERT ON public.lembretes
FOR EACH ROW
EXECUTE FUNCTION public.set_lembretes_defaults();

-- 3. Habilitar RLS
ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas para recriar corretamente
DROP POLICY IF EXISTS "Acesso Total Lembretes" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Pessoais" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Select OwnOrSystem" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Manage Own" ON public.lembretes;

CREATE POLICY "Lembretes Select Manual" ON public.lembretes
    FOR SELECT
    TO authenticated
    USING (tipo = 'manual' AND created_by = auth.uid());

CREATE POLICY "Lembretes Select Birthday" ON public.lembretes
    FOR SELECT
    TO authenticated
    USING (tipo = 'birthday' AND public.is_tenant_match(tenant_id));

CREATE POLICY "Lembretes Insert Manual" ON public.lembretes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tipo = 'manual'
        AND (created_by = auth.uid() OR created_by IS NULL)
        AND (tenant_id IS NULL OR public.is_tenant_match(tenant_id))
    );

CREATE POLICY "Lembretes Insert Birthday" ON public.lembretes
    FOR INSERT
    TO authenticated
    WITH CHECK (tipo = 'birthday' AND public.is_tenant_match(tenant_id));

CREATE POLICY "Lembretes Update Manual" ON public.lembretes
    FOR UPDATE
    TO authenticated
    USING (tipo = 'manual' AND created_by = auth.uid())
    WITH CHECK (tipo = 'manual' AND created_by = auth.uid());

CREATE POLICY "Lembretes Delete Manual" ON public.lembretes
    FOR DELETE
    TO authenticated
    USING (tipo = 'manual' AND created_by = auth.uid());
