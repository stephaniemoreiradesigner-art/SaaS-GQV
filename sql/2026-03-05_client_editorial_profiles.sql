-- Tabela para armazenar o perfil editorial (nicho, tom de voz, etc.)
CREATE TABLE IF NOT EXISTS public.client_editorial_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    cliente_id bigint NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    nicho_atuacao text,
    publico_alvo text,
    objetivos text,
    tom_de_voz text,
    restricoes text,
    produto_servico text,
    diferenciais text,
    palavras_proibidas text,
    persona_briefing text,
    client_insights text,
    visual_identity text,
    brand_kit_url text,
    reference_doc_url text,
    ai_memory_summary text,
    ai_memory_updated_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índice único para garantir um perfil por cliente no tenant
CREATE UNIQUE INDEX IF NOT EXISTS client_editorial_profiles_tenant_client_idx ON public.client_editorial_profiles (tenant_id, cliente_id);

-- RLS
ALTER TABLE public.client_editorial_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (baseadas em tenant_id e cliente_id)
-- Leitura: qualquer usuário autenticado do mesmo tenant
CREATE POLICY "Editorial Profiles Select Tenant" ON public.client_editorial_profiles
FOR SELECT TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.client_memberships cm
        WHERE cm.user_id = auth.uid() AND cm.client_id = client_editorial_profiles.cliente_id
    )
);

-- Escrita: apenas usuários com permissão (simplificado para tenant match)
CREATE POLICY "Editorial Profiles Insert Tenant" ON public.client_editorial_profiles
FOR INSERT TO authenticated
WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Editorial Profiles Update Tenant" ON public.client_editorial_profiles
FOR UPDATE TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Editorial Profiles Delete Tenant" ON public.client_editorial_profiles
FOR DELETE TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);
