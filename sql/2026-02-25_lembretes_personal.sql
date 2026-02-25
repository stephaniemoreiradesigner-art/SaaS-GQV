ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS data DATE;

UPDATE public.lembretes
SET created_by = user_id
WHERE created_by IS NULL AND user_id IS NOT NULL;

UPDATE public.lembretes l
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE l.tenant_id IS NULL
  AND l.created_by IS NOT NULL
  AND p.id = l.created_by;

UPDATE public.lembretes
SET tipo = CASE
    WHEN tipo IS NOT NULL THEN tipo
    WHEN created_by IS NOT NULL THEN 'manual'
    ELSE 'system'
END;

ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lembretes Select Manual Own" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Manage Manual Own" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Select Birthday" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Select System Own" ON public.lembretes;

CREATE POLICY "Lembretes Select Manual Own" ON public.lembretes
FOR SELECT TO authenticated
USING (tipo = 'manual' AND created_by = auth.uid() AND public.is_tenant_match(tenant_id));

CREATE POLICY "Lembretes Manage Manual Own" ON public.lembretes
FOR ALL TO authenticated
USING (tipo = 'manual' AND created_by = auth.uid() AND public.is_tenant_match(tenant_id))
WITH CHECK (tipo = 'manual' AND created_by = auth.uid() AND public.is_tenant_match(tenant_id));

CREATE POLICY "Lembretes Select Birthday" ON public.lembretes
FOR SELECT TO authenticated
USING (tipo = 'birthday');

CREATE POLICY "Lembretes Select System Own" ON public.lembretes
FOR SELECT TO authenticated
USING (tipo = 'system' AND created_by = auth.uid() AND public.is_tenant_match(tenant_id));
