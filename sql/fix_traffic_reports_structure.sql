-- Atualização CRÍTICA para tabela traffic_reports_data e Permissões
-- 1. Adicionar coluna 'platform' se não existir
ALTER TABLE public.traffic_reports_data 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'meta_ads';

-- 2. Recriar Políticas de Segurança (RLS) para evitar erros 404/403
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.traffic_reports_data;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.traffic_reports_data;

CREATE POLICY "Enable read access for authenticated users"
ON public.traffic_reports_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON public.traffic_reports_data FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON public.traffic_reports_data FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete access for authenticated users"
ON public.traffic_reports_data FOR DELETE
TO authenticated
USING (true);

-- 3. Garantir permissões de acesso (Grants)
GRANT ALL ON public.traffic_reports_data TO authenticated;
GRANT ALL ON public.traffic_reports_data TO service_role;
