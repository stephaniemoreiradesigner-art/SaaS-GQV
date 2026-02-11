ALTER TABLE public.colaboradores
ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_user_id_unique
ON public.colaboradores(user_id)
WHERE user_id IS NOT NULL;

WITH matched AS (
    SELECT
        c.id AS colaborador_id,
        u.id AS user_id
    FROM public.colaboradores c
    JOIN LATERAL (
        SELECT id
        FROM auth.users u
        WHERE lower(u.email) = lower(c.email)
        ORDER BY created_at ASC
        LIMIT 1
    ) u ON true
    WHERE c.user_id IS NULL
      AND c.email IS NOT NULL
)
UPDATE public.colaboradores c
SET user_id = m.user_id
FROM matched m
WHERE c.id = m.colaborador_id;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role');
  IF jwt_role IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  ) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.colaboradores
    WHERE (user_id = auth.uid() OR (user_id IS NULL AND lower(email) = lower(auth.email())))
      AND perfil_acesso IN ('super_admin', 'admin')
      AND ativo = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_colaborador_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  result_id uuid;
BEGIN
  SELECT c.id INTO result_id
  FROM public.colaboradores c
  WHERE (c.user_id = auth.uid() OR (c.user_id IS NULL AND lower(c.email) = lower(auth.email())))
  ORDER BY CASE WHEN c.user_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;
  RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_colaborador_departamento()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  dept text;
  normalized text;
BEGIN
  SELECT c.departamento INTO dept
  FROM public.colaboradores c
  WHERE (c.user_id = auth.uid() OR (c.user_id IS NULL AND lower(c.email) = lower(auth.email())))
  ORDER BY CASE WHEN c.user_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;
  IF dept IS NULL THEN
    RETURN NULL;
  END IF;
  normalized := lower(trim(dept));
  IF normalized IN ('gestor_trafego', 'tráfego pago', 'trafego pago', 'trafego') THEN
    RETURN 'Tráfego Pago';
  END IF;
  IF normalized IN ('social_media', 'social media') THEN
    RETURN 'Social Media';
  END IF;
  RETURN dept;
END;
$$;

ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS responsavel_trafego_colaborador_id uuid REFERENCES public.colaboradores(id),
ADD COLUMN IF NOT EXISTS responsavel_social_colaborador_id uuid REFERENCES public.colaboradores(id);

ALTER TABLE public.tarefas
ADD COLUMN IF NOT EXISTS assigned_to_colaborador_id uuid REFERENCES public.colaboradores(id),
ADD COLUMN IF NOT EXISTS created_by_colaborador_id uuid REFERENCES public.colaboradores(id);

CREATE TABLE IF NOT EXISTS public.registros_gerais (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id bigint REFERENCES public.clientes(id) ON DELETE CASCADE,
    tipo text,
    texto text,
    created_by_colaborador_id uuid REFERENCES public.colaboradores(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.registros_gerais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RegistrosGerais Select" ON public.registros_gerais;
DROP POLICY IF EXISTS "RegistrosGerais Insert" ON public.registros_gerais;

CREATE POLICY "RegistrosGerais Select" ON public.registros_gerais
FOR SELECT TO authenticated
USING (
  public.is_tenant_match(cliente_id)
  AND (
    public.is_admin()
    OR (
      public.current_colaborador_departamento() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = registros_gerais.cliente_id
          AND (
            (c.responsavel_trafego_colaborador_id IS NOT NULL AND public.current_colaborador_departamento() = 'Tráfego Pago')
            OR (c.responsavel_social_colaborador_id IS NOT NULL AND public.current_colaborador_departamento() = 'Social Media')
          )
      )
    )
  )
);

CREATE POLICY "RegistrosGerais Insert" ON public.registros_gerais
FOR INSERT TO authenticated
WITH CHECK (
  public.is_tenant_match(cliente_id)
  AND created_by_colaborador_id = public.current_colaborador_id()
  AND (
    public.is_admin()
    OR (
      public.current_colaborador_departamento() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = registros_gerais.cliente_id
          AND (
            (c.responsavel_trafego_colaborador_id IS NOT NULL AND public.current_colaborador_departamento() = 'Tráfego Pago')
            OR (c.responsavel_social_colaborador_id IS NOT NULL AND public.current_colaborador_departamento() = 'Social Media')
          )
      )
    )
  )
);

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "Tarefas Select Responsavel" ON public.tarefas;
DROP POLICY IF EXISTS "Tarefas Insert Responsavel" ON public.tarefas;
DROP POLICY IF EXISTS "Tarefas Update Responsavel" ON public.tarefas;
DROP POLICY IF EXISTS "Tarefas Delete Responsavel" ON public.tarefas;

CREATE POLICY "Tarefas Select Responsavel" ON public.tarefas
FOR SELECT TO authenticated
USING (
  public.is_tenant_match(cliente_id)
  AND (
    public.is_admin()
    OR assigned_to_colaborador_id = public.current_colaborador_id()
    OR EXISTS (
      SELECT 1 FROM public.tarefa_atribuicoes ta
      WHERE ta.tarefa_id = tarefas.id
        AND lower(ta.usuario_email) = lower(auth.email())
    )
  )
);

CREATE POLICY "Tarefas Insert Responsavel" ON public.tarefas
FOR INSERT TO authenticated
WITH CHECK (
  public.is_tenant_match(cliente_id)
  AND (
    created_by_colaborador_id = public.current_colaborador_id()
    OR criado_por = auth.uid()
  )
  AND (
    assigned_to_colaborador_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = tarefas.cliente_id
        AND assigned_to_colaborador_id IN (c.responsavel_trafego_colaborador_id, c.responsavel_social_colaborador_id)
    )
  )
);

CREATE POLICY "Tarefas Update Responsavel" ON public.tarefas
FOR UPDATE TO authenticated
USING (
  public.is_tenant_match(cliente_id)
  AND (
    public.is_admin()
    OR assigned_to_colaborador_id = public.current_colaborador_id()
    OR EXISTS (
      SELECT 1 FROM public.tarefa_atribuicoes ta
      WHERE ta.tarefa_id = tarefas.id
        AND lower(ta.usuario_email) = lower(auth.email())
    )
  )
)
WITH CHECK (
  public.is_tenant_match(cliente_id)
  AND (
    public.is_admin()
    OR assigned_to_colaborador_id = public.current_colaborador_id()
    OR EXISTS (
      SELECT 1 FROM public.tarefa_atribuicoes ta
      WHERE ta.tarefa_id = tarefas.id
        AND lower(ta.usuario_email) = lower(auth.email())
    )
  )
);

CREATE POLICY "Tarefas Delete Responsavel" ON public.tarefas
FOR DELETE TO authenticated
USING (
  public.is_tenant_match(cliente_id)
  AND (
    public.is_admin()
    OR assigned_to_colaborador_id = public.current_colaborador_id()
    OR EXISTS (
      SELECT 1 FROM public.tarefa_atribuicoes ta
      WHERE ta.tarefa_id = tarefas.id
        AND lower(ta.usuario_email) = lower(auth.email())
    )
  )
);
