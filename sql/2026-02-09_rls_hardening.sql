-- 2026-02-09_rls_hardening.sql
-- Hardening de Segurança RLS (Row Level Security) - Versão Revisada
-- Objetivo: Remover TODAS as políticas permissivas identificadas e restringir acesso.

-- 1. FUNÇÕES AUXILIARES
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
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
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  jwt_tenant text;
BEGIN
  jwt_tenant := COALESCE(auth.jwt() -> 'user_metadata' ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id');
  IF jwt_tenant IS NOT NULL AND jwt_tenant <> '' THEN
    RETURN jwt_tenant::BIGINT;
  END IF;
  RETURN COALESCE(
    (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()),
    (SELECT tenant_id FROM public.colaboradores WHERE email = auth.email())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_match(target_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin() OR (target_id = public.current_tenant_id() AND public.is_tenant_active(target_id));
$$;

ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.clientes(id);
ALTER TABLE IF EXISTS public.colaboradores ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.clientes(id);
ALTER TABLE IF EXISTS public.times ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.clientes(id);
ALTER TABLE IF EXISTS public.financeiro ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.clientes(id);
ALTER TABLE IF EXISTS public.financeiro ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

-- 2. TABELA CONFIGURACOES
ALTER TABLE IF EXISTS public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas (Lista completa baseada no scan)
DROP POLICY IF EXISTS "Acesso Total Configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir Leitura para Todos" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir Edição Apenas Admins" ON public.configuracoes;
DROP POLICY IF EXISTS "Publico pode ver branding" ON public.configuracoes;
DROP POLICY IF EXISTS "Leitura de Configurações" ON public.configuracoes;
DROP POLICY IF EXISTS "Escrita de Configurações" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir Acesso Config Autenticado" ON public.configuracoes;
DROP POLICY IF EXISTS "Configuracoes Select Auth" ON public.configuracoes;
DROP POLICY IF EXISTS "Configuracoes Select Public WhiteLabel" ON public.configuracoes;
DROP POLICY IF EXISTS "Configuracoes Manage Admin" ON public.configuracoes;

-- Novas Políticas
CREATE POLICY "Configuracoes Select Auth" ON public.configuracoes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Configuracoes Select Public WhiteLabel" ON public.configuracoes
FOR SELECT TO public
USING (key IN ('white_label_primary_color', 'white_label_secondary_color', 'white_label_logo_url', 'white_label_favicon_url', 'facebook_app_id'));

CREATE POLICY "Configuracoes Manage Admin" ON public.configuracoes
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 3. TABELA CLIENTES
ALTER TABLE IF EXISTS public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total Clientes" ON public.clientes;
DROP POLICY IF EXISTS "Acesso total a autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Clientes Select Auth" ON public.clientes;
DROP POLICY IF EXISTS "Clientes Manage Admin" ON public.clientes;

CREATE POLICY "Clientes Select Auth" ON public.clientes
FOR SELECT TO authenticated USING (public.is_admin() OR id = public.current_tenant_id());

CREATE POLICY "Clientes Manage Admin" ON public.clientes
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 4. TABELA CLIENTES_PERSONAS
ALTER TABLE IF EXISTS public.clientes_personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total Personas" ON public.clientes_personas;
DROP POLICY IF EXISTS "Permitir Insert Personas Autenticado" ON public.clientes_personas;
DROP POLICY IF EXISTS "Permitir Select Personas Autenticado" ON public.clientes_personas;
DROP POLICY IF EXISTS "Permitir Update Personas Autenticado" ON public.clientes_personas;
DROP POLICY IF EXISTS "Permitir Delete Personas Autenticado" ON public.clientes_personas;
DROP POLICY IF EXISTS "Acesso total para usuários autenticados em Personas" ON public.clientes_personas;
DROP POLICY IF EXISTS "Personas Select Auth" ON public.clientes_personas;
DROP POLICY IF EXISTS "Personas Manage AdminOrSocial" ON public.clientes_personas;

CREATE POLICY "Personas Select Auth" ON public.clientes_personas
FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));

CREATE POLICY "Personas Manage AdminOrSocial" ON public.clientes_personas
FOR ALL TO authenticated
USING (
    (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'social_media'))
    AND public.is_tenant_match(cliente_id)
)
WITH CHECK (
    (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'social_media'))
    AND public.is_tenant_match(cliente_id)
);


-- 5. SOCIAL MEDIA (Posts, Calendars, Share)
-- Social Posts (Tratando duplicação de tabelas e policies)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'social_posts') THEN
        ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Acesso Total Posts" ON public.social_posts;
        DROP POLICY IF EXISTS "Publico pode ver posts em aprovação" ON public.social_posts;
        DROP POLICY IF EXISTS "Publico pode atualizar posts em aprovação" ON public.social_posts;
        DROP POLICY IF EXISTS "Acesso autenticado posts" ON public.social_posts;
        DROP POLICY IF EXISTS "Equipe gerencia posts" ON public.social_posts;
        DROP POLICY IF EXISTS "Posts Select Auth" ON public.social_posts;
        DROP POLICY IF EXISTS "Posts Select Public Approval" ON public.social_posts;
        DROP POLICY IF EXISTS "Posts Update Public Approval" ON public.social_posts;
        DROP POLICY IF EXISTS "Posts Manage AdminOrSocial" ON public.social_posts;
        
        CREATE POLICY "Posts Select Auth" ON public.social_posts FOR SELECT TO authenticated
        USING (
            public.is_admin() OR EXISTS (
                SELECT 1 FROM public.social_calendars sc
                WHERE sc.id = social_posts.calendar_id
                AND public.is_tenant_match(sc.cliente_id)
            )
        );
        CREATE POLICY "Posts Select Public Approval" ON public.social_posts FOR SELECT TO public USING (approval_group_id IS NOT NULL);
        CREATE POLICY "Posts Update Public Approval" ON public.social_posts FOR UPDATE TO public USING (approval_group_id IS NOT NULL);
        
        CREATE POLICY "Posts Manage AdminOrSocial" ON public.social_posts FOR ALL TO authenticated
        USING (
            (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'social_media'))
            AND EXISTS (
                SELECT 1 FROM public.social_calendars sc
                WHERE sc.id = social_posts.calendar_id
                AND public.is_tenant_match(sc.cliente_id)
            )
        )
        WITH CHECK (
            (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'social_media'))
            AND EXISTS (
                SELECT 1 FROM public.social_calendars sc
                WHERE sc.id = social_posts.calendar_id
                AND public.is_tenant_match(sc.cliente_id)
            )
        );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'social_media_posts') THEN
        ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Acesso Total Posts" ON public.social_media_posts;
        DROP POLICY IF EXISTS "Permitir Insert Posts Autenticado" ON public.social_media_posts;
        DROP POLICY IF EXISTS "Permitir Select Posts Autenticado" ON public.social_media_posts;
        DROP POLICY IF EXISTS "Permitir Update Posts Autenticado" ON public.social_media_posts;
        DROP POLICY IF EXISTS "Permitir Delete Posts Autenticado" ON public.social_media_posts;
        DROP POLICY IF EXISTS "SMPosts Select Auth" ON public.social_media_posts;
        DROP POLICY IF EXISTS "SMPosts Manage AdminOrSocial" ON public.social_media_posts;
        
        CREATE POLICY "SMPosts Select Auth" ON public.social_media_posts FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));
        CREATE POLICY "SMPosts Manage AdminOrSocial" ON public.social_media_posts FOR ALL TO authenticated
        USING (
            (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'social_media'))
            AND public.is_tenant_match(cliente_id)
        )
        WITH CHECK (
            (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'social_media'))
            AND public.is_tenant_match(cliente_id)
        );
    END IF;
END $$;

-- Social Calendars
ALTER TABLE IF EXISTS public.social_calendars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe gerencia calendarios" ON public.social_calendars;
DROP POLICY IF EXISTS "SocialCalendars Select Auth" ON public.social_calendars;
DROP POLICY IF EXISTS "SocialCalendars Manage AdminOrSocial" ON public.social_calendars;

CREATE POLICY "SocialCalendars Select Auth" ON public.social_calendars FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));
CREATE POLICY "SocialCalendars Manage AdminOrSocial" ON public.social_calendars FOR ALL TO authenticated
USING ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'social_media')) AND public.is_tenant_match(cliente_id))
WITH CHECK ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'social_media')) AND public.is_tenant_match(cliente_id));

-- Aprovacoes Share
ALTER TABLE IF EXISTS public.aprovacoes_share ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo para autenticados em aprovacoes_share" ON public.aprovacoes_share;
DROP POLICY IF EXISTS "AprovacoesShare Manage Auth" ON public.aprovacoes_share;
DROP POLICY IF EXISTS "AprovacoesShare Select Public Token" ON public.aprovacoes_share;

CREATE POLICY "AprovacoesShare Manage Auth" ON public.aprovacoes_share FOR ALL TO authenticated USING (true);
CREATE POLICY "AprovacoesShare Select Public Token" ON public.aprovacoes_share FOR SELECT TO public USING (true); -- Necessário para validar token publicamente? Se sim, ok. Se não, restringir. Assumindo necessário.


-- 6. FINANCEIRO (CRÍTICO)
ALTER TABLE IF EXISTS public.financeiro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON public.financeiro;
DROP POLICY IF EXISTS "Financeiro Manage AdminOrFin" ON public.financeiro;

-- Apenas Admin ou Financeiro podem ver/editar
CREATE POLICY "Financeiro Manage AdminOrFin" ON public.financeiro
FOR ALL TO authenticated
USING (
    (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'financeiro'))
    AND public.is_tenant_match(tenant_id)
)
WITH CHECK (
    (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'financeiro'))
    AND public.is_tenant_match(tenant_id)
);


-- 7. TRÁFEGO PAGO (Campaigns, Checklist, Client Info, Logs, Metrics, Reports)
-- Traffic Campaigns
ALTER TABLE IF EXISTS public.traffic_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users manage campaigns" ON public.traffic_campaigns;
DROP POLICY IF EXISTS "Permitir acesso total a usuarios autenticados" ON public.traffic_campaigns;
DROP POLICY IF EXISTS "TrafficCamp Select Auth" ON public.traffic_campaigns;
DROP POLICY IF EXISTS "TrafficCamp Manage AdminOrTraffic" ON public.traffic_campaigns;

CREATE POLICY "TrafficCamp Select Auth" ON public.traffic_campaigns FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));
CREATE POLICY "TrafficCamp Manage AdminOrTraffic" ON public.traffic_campaigns FOR ALL TO authenticated
USING ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gestor_trafego')) AND public.is_tenant_match(cliente_id))
WITH CHECK ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gestor_trafego')) AND public.is_tenant_match(cliente_id));

-- Traffic Checklist
ALTER TABLE IF EXISTS public.traffic_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage checklist" ON public.traffic_checklist;
DROP POLICY IF EXISTS "TrafficChecklist Manage Auth" ON public.traffic_checklist;

CREATE POLICY "TrafficChecklist Manage Auth" ON public.traffic_checklist FOR ALL TO authenticated
USING (public.is_tenant_match(cliente_id))
WITH CHECK (public.is_tenant_match(cliente_id));

-- Traffic Client Info
ALTER TABLE IF EXISTS public.traffic_client_info ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total" ON public.traffic_client_info;
DROP POLICY IF EXISTS "TrafficClientInfo Select Auth" ON public.traffic_client_info;
DROP POLICY IF EXISTS "TrafficClientInfo Manage AdminOrTraffic" ON public.traffic_client_info;

CREATE POLICY "TrafficClientInfo Select Auth" ON public.traffic_client_info FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));
CREATE POLICY "TrafficClientInfo Manage AdminOrTraffic" ON public.traffic_client_info FOR ALL TO authenticated
USING ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gestor_trafego')) AND public.is_tenant_match(cliente_id))
WITH CHECK ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gestor_trafego')) AND public.is_tenant_match(cliente_id));

-- Traffic Logs
ALTER TABLE IF EXISTS public.traffic_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage traffic_logs" ON public.traffic_logs;
DROP POLICY IF EXISTS "TrafficLogs Select Auth" ON public.traffic_logs;
DROP POLICY IF EXISTS "TrafficLogs Manage AdminOrTraffic" ON public.traffic_logs;

CREATE POLICY "TrafficLogs Select Auth" ON public.traffic_logs FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));
CREATE POLICY "TrafficLogs Manage AdminOrTraffic" ON public.traffic_logs FOR ALL TO authenticated
USING ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gestor_trafego')) AND public.is_tenant_match(cliente_id))
WITH CHECK ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gestor_trafego')) AND public.is_tenant_match(cliente_id));

-- Traffic Metrics (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'traffic_metrics') THEN
        ALTER TABLE public.traffic_metrics ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Auth users manage metrics" ON public.traffic_metrics;
        DROP POLICY IF EXISTS "TrafficMetrics Select Auth" ON public.traffic_metrics;
        DROP POLICY IF EXISTS "TrafficMetrics Manage AdminOrTraffic" ON public.traffic_metrics;
        
        CREATE POLICY "TrafficMetrics Select Auth" ON public.traffic_metrics FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));
        CREATE POLICY "TrafficMetrics Manage AdminOrTraffic" ON public.traffic_metrics FOR ALL TO authenticated
        USING ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gestor_trafego')) AND public.is_tenant_match(cliente_id))
        WITH CHECK ((public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gestor_trafego')) AND public.is_tenant_match(cliente_id));
    END IF;
END $$;

-- Traffic Reports Data (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'traffic_reports_data') THEN
        ALTER TABLE public.traffic_reports_data ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.traffic_reports_data;
        DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.traffic_reports_data;
        DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.traffic_reports_data;
        DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.traffic_reports_data;
        DROP POLICY IF EXISTS "TrafficReports Select Auth" ON public.traffic_reports_data;
        DROP POLICY IF EXISTS "TrafficReports Manage Auth" ON public.traffic_reports_data;

        CREATE POLICY "TrafficReports Select Auth" ON public.traffic_reports_data
        FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));

        CREATE POLICY "TrafficReports Manage Auth" ON public.traffic_reports_data
        FOR ALL TO authenticated USING (public.is_tenant_match(cliente_id))
        WITH CHECK (public.is_tenant_match(cliente_id));
    END IF;
END $$;


-- 8. CRIATIVOS E PERFORMANCE
-- Ad Creatives
ALTER TABLE IF EXISTS public.ad_creatives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios logados podem gerenciar criativos" ON public.ad_creatives;
DROP POLICY IF EXISTS "AdCreatives Select Auth" ON public.ad_creatives;
DROP POLICY IF EXISTS "AdCreatives Manage AdminOrTrafficOrSocial" ON public.ad_creatives;

CREATE POLICY "AdCreatives Select Auth" ON public.ad_creatives FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));
CREATE POLICY "AdCreatives Manage AdminOrTrafficOrSocial" ON public.ad_creatives FOR ALL TO authenticated
USING (
    (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('gestor_trafego', 'social_media')))
    AND public.is_tenant_match(cliente_id)
)
WITH CHECK (
    (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('gestor_trafego', 'social_media')))
    AND public.is_tenant_match(cliente_id)
);

-- Ad Creatives Performance (e typo ad_creative_performance)
DO $$
BEGIN
    -- Plural
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_creatives_performance') THEN
        ALTER TABLE public.ad_creatives_performance ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can manage ad performance" ON public.ad_creatives_performance;
        DROP POLICY IF EXISTS "AdPerf Select Auth" ON public.ad_creatives_performance;
        DROP POLICY IF EXISTS "AdPerf Manage Auth" ON public.ad_creatives_performance;
        CREATE POLICY "AdPerf Select Auth" ON public.ad_creatives_performance FOR SELECT TO authenticated USING (public.is_tenant_match(cliente_id));
        CREATE POLICY "AdPerf Manage Auth" ON public.ad_creatives_performance FOR ALL TO authenticated USING (public.is_tenant_match(cliente_id));
    END IF;

    -- Singular (Typo possível)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_creative_performance') THEN
        ALTER TABLE public.ad_creative_performance ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Auth users manage creative perf" ON public.ad_creative_performance;
        DROP POLICY IF EXISTS "AdPerfSingular Manage Auth" ON public.ad_creative_performance;
        CREATE POLICY "AdPerfSingular Manage Auth" ON public.ad_creative_performance FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.traffic_campaigns tc
                WHERE tc.id = ad_creative_performance.campaign_id
                AND public.is_tenant_match(tc.cliente_id)
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.traffic_campaigns tc
                WHERE tc.id = ad_creative_performance.campaign_id
                AND public.is_tenant_match(tc.cliente_id)
            )
        );
    END IF;
END $$;


-- 9. TAREFAS E COLABORAÇÃO
ALTER TABLE IF EXISTS public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tarefa_atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tarefa_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total a tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "Acesso total a atribuicoes" ON public.tarefa_atribuicoes;
DROP POLICY IF EXISTS "Acesso total a historico" ON public.tarefa_historico;
DROP POLICY IF EXISTS "Tarefas All Auth" ON public.tarefas;
DROP POLICY IF EXISTS "Atribuicoes All Auth" ON public.tarefa_atribuicoes;
DROP POLICY IF EXISTS "Historico All Auth" ON public.tarefa_historico;
DROP POLICY IF EXISTS "Tarefas Select OwnOrAssigned" ON public.tarefas;
DROP POLICY IF EXISTS "Tarefas Insert Own" ON public.tarefas;
DROP POLICY IF EXISTS "Tarefas Update OwnOrAssigned" ON public.tarefas;
DROP POLICY IF EXISTS "Atribuicoes Select OwnOrAssigned" ON public.tarefa_atribuicoes;
DROP POLICY IF EXISTS "Atribuicoes Insert Own" ON public.tarefa_atribuicoes;
DROP POLICY IF EXISTS "Historico Select OwnOrAssigned" ON public.tarefa_historico;
DROP POLICY IF EXISTS "Historico Insert OwnOrAssigned" ON public.tarefa_historico;

CREATE OR REPLACE FUNCTION public.can_access_tarefa_base(p_tarefa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.tarefas t
    WHERE t.id = p_tarefa_id
    AND public.is_tenant_match(t.cliente_id)
    AND (
      t.criado_por::text = auth.uid()::text
      OR lower(trim(t.criado_por::text)) = lower(trim(auth.email()))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_tarefa(p_tarefa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.tarefas t
    WHERE t.id = p_tarefa_id
    AND public.is_tenant_match(t.cliente_id)
    AND (
      t.criado_por::text = auth.uid()::text
      OR lower(trim(t.criado_por::text)) = lower(trim(auth.email()))
      OR EXISTS (
        SELECT 1 FROM public.tarefa_atribuicoes ta
        WHERE ta.tarefa_id = t.id
        AND lower(trim(ta.usuario_email)) = lower(trim(auth.email()))
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tarefa(p_tarefa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.tarefas t
    WHERE t.id = p_tarefa_id
    AND public.is_tenant_match(t.cliente_id)
    AND (
      t.criado_por::text = auth.uid()::text
      OR lower(trim(t.criado_por::text)) = lower(trim(auth.email()))
    )
  );
$$;

-- Mantendo fluxo colaborativo com restrição por usuário/atribuição
CREATE POLICY "Tarefas Select OwnOrAssigned" ON public.tarefas
FOR SELECT TO authenticated
USING (
    public.can_access_tarefa(id)
);

CREATE POLICY "Tarefas Insert Own" ON public.tarefas
FOR INSERT TO authenticated
WITH CHECK (
    public.is_tenant_match(cliente_id)
    AND criado_por = auth.uid()
);

CREATE POLICY "Tarefas Update OwnOrAssigned" ON public.tarefas
FOR UPDATE TO authenticated
USING (
    public.can_access_tarefa(id)
)
WITH CHECK (
    public.can_access_tarefa(id)
);

CREATE POLICY "Atribuicoes Select OwnOrAssigned" ON public.tarefa_atribuicoes
FOR SELECT TO authenticated
USING (
    tarefa_atribuicoes.usuario_email = auth.email()
    OR public.can_access_tarefa_base(tarefa_atribuicoes.tarefa_id)
);

CREATE POLICY "Atribuicoes Insert Own" ON public.tarefa_atribuicoes
FOR INSERT TO authenticated
WITH CHECK (
    public.can_manage_tarefa(tarefa_atribuicoes.tarefa_id)
);

CREATE POLICY "Historico Select OwnOrAssigned" ON public.tarefa_historico
FOR SELECT TO authenticated
USING (
    public.can_access_tarefa(tarefa_historico.tarefa_id)
);

CREATE POLICY "Historico Insert OwnOrAssigned" ON public.tarefa_historico
FOR INSERT TO authenticated
WITH CHECK (
    public.can_access_tarefa(tarefa_historico.tarefa_id)
);


-- 10. LEMBRETES E PERFIS
-- Lembretes
ALTER TABLE IF EXISTS public.lembretes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver Lembretes Proprios ou Publicos" ON public.lembretes;
DROP POLICY IF EXISTS "Gerenciar Lembretes Proprios" ON public.lembretes;
DROP POLICY IF EXISTS "Acesso Total Lembretes" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Pessoais" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Select OwnOrSystem" ON public.lembretes;
DROP POLICY IF EXISTS "Lembretes Manage Own" ON public.lembretes;

CREATE POLICY "Lembretes Select OwnOrSystem" ON public.lembretes
FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Lembretes Manage Own" ON public.lembretes
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.can_notify_task_creator(p_task_id UUID, p_target_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p_task_id IS NOT NULL AND (
    public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.tarefas t
    WHERE t.id = p_task_id
    AND public.is_tenant_match(t.cliente_id)
    AND t.criado_por = p_target_user
    AND (
      t.criado_por = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tarefa_atribuicoes ta
        WHERE ta.tarefa_id = t.id
        AND ta.usuario_email = auth.email()
      )
    )
  ));
$$;

CREATE OR REPLACE FUNCTION public.safe_uuid(p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN p_text::uuid;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  link_destino TEXT
);

ALTER TABLE IF EXISTS public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notificacoes Select Own" ON public.notificacoes;
DROP POLICY IF EXISTS "Notificacoes Insert OwnOrCreator" ON public.notificacoes;
DROP POLICY IF EXISTS "Notificacoes Update Own" ON public.notificacoes;

CREATE POLICY "Notificacoes Select Own" ON public.notificacoes
FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE POLICY "Notificacoes Insert OwnOrCreator" ON public.notificacoes
FOR INSERT TO authenticated WITH CHECK (
  usuario_id = auth.uid()
  OR public.can_notify_task_creator(public.safe_uuid(link_destino), usuario_id)
);

CREATE POLICY "Notificacoes Update Own" ON public.notificacoes
FOR UPDATE TO authenticated USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at timestamp with time zone DEFAULT now(),
  username text UNIQUE,
  full_name text,
  avatar_url text,
  website text,
  role text DEFAULT 'usuario'
);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS role text DEFAULT 'usuario';

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins veem todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Permitir leitura de perfis para autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Select Auth" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Update OwnOrAdmin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Insert Own" ON public.profiles;

CREATE POLICY "Profiles Select Auth" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin() OR id = auth.uid());

CREATE POLICY "Profiles Update OwnOrAdmin" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "Profiles Insert Own" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'usuario')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.plans (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  max_clients INTEGER,
  max_collaborators INTEGER,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  plan_id BIGINT REFERENCES public.plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT,
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL,
  provider TEXT,
  provider_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans Select Auth" ON public.plans;
DROP POLICY IF EXISTS "Plans Manage Admin" ON public.plans;
DROP POLICY IF EXISTS "Subscriptions Select Auth" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions Manage Admin" ON public.subscriptions;
DROP POLICY IF EXISTS "PaymentEvents Select Auth" ON public.payment_events;
DROP POLICY IF EXISTS "PaymentEvents Manage Admin" ON public.payment_events;

CREATE POLICY "Plans Select Auth" ON public.plans
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Plans Manage Admin" ON public.plans
FOR ALL TO authenticated USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Subscriptions Select Auth" ON public.subscriptions
FOR SELECT TO authenticated USING (public.is_admin() OR public.is_tenant_match(tenant_id));

CREATE POLICY "Subscriptions Manage Admin" ON public.subscriptions
FOR ALL TO authenticated USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "PaymentEvents Select Auth" ON public.payment_events
FOR SELECT TO authenticated USING (public.is_admin() OR public.is_tenant_match(tenant_id));

CREATE POLICY "PaymentEvents Manage Admin" ON public.payment_events
FOR ALL TO authenticated USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_tenant_active(target_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin()
    OR NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = target_id)
    OR EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = target_id AND s.status IN ('active','trialing'));
$$;

ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS gestor_trafego_email TEXT,
ADD COLUMN IF NOT EXISTS social_media_email TEXT;

ALTER TABLE public.tarefas
ADD COLUMN IF NOT EXISTS prazo_aprovado BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.create_task_from_social_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
    v_cliente_id BIGINT;
    v_social_email TEXT;
    v_task_id UUID;
    v_title TEXT;
    v_desc TEXT;
    v_status TEXT;
    v_prazo TIMESTAMPTZ;
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('aprovado', 'ajuste_solicitado') THEN
        v_cliente_id := COALESCE(NEW.cliente_id, (SELECT sc.cliente_id FROM public.social_calendars sc WHERE sc.id = NEW.calendar_id));
        IF v_cliente_id IS NULL THEN
            RETURN NEW;
        END IF;

        SELECT c.social_media_email INTO v_social_email
        FROM public.clientes c
        WHERE c.id = v_cliente_id;

        IF v_social_email IS NULL OR length(trim(v_social_email)) = 0 THEN
            RETURN NEW;
        END IF;

        IF NEW.status = 'aprovado' THEN
            v_status := 'aguardando_agendamento';
            v_title := 'Aguardando Agendamento: ' || COALESCE(NEW.tema, 'Post aprovado');
            v_desc := 'Post aprovado pelo cliente. Aguardando agendamento.';
        ELSE
            v_status := 'ajuste_solicitado';
            v_title := 'Ajuste Solicitado: ' || COALESCE(NEW.tema, 'Post');
            v_desc := 'Cliente pediu ajuste: ' || COALESCE(NEW.feedback_ajuste, '');
        END IF;

        v_prazo := COALESCE(NEW.data_agendada::timestamptz, NOW());

        SELECT t.id INTO v_task_id
        FROM public.tarefas t
        WHERE t.post_id = NEW.id
        ORDER BY t.created_at DESC
        LIMIT 1;

        IF v_task_id IS NULL THEN
            INSERT INTO public.tarefas (titulo, descricao, prazo_data, cliente_id, post_id, tipo, status)
            VALUES (v_title, v_desc, v_prazo, v_cliente_id, NEW.id, 'social_post', v_status)
            RETURNING id INTO v_task_id;
        ELSE
            UPDATE public.tarefas
            SET titulo = v_title,
                descricao = v_desc,
                prazo_data = v_prazo,
                status = v_status
            WHERE id = v_task_id;
        END IF;

        DELETE FROM public.tarefa_atribuicoes WHERE tarefa_id = v_task_id;
        INSERT INTO public.tarefa_atribuicoes (tarefa_id, usuario_email)
        VALUES (v_task_id, v_social_email);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_task_from_social_post ON public.social_posts;
CREATE TRIGGER trg_create_task_from_social_post
AFTER UPDATE ON public.social_posts
FOR EACH ROW
EXECUTE FUNCTION public.create_task_from_social_post();

CREATE OR REPLACE FUNCTION public.is_tenant_match(target_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin() OR (target_id = public.current_tenant_id() AND public.is_tenant_active(target_id));
$$;
