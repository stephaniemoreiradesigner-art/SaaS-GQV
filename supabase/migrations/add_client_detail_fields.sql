ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS social_responsavel TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS trafego_responsavel TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS plataformas_usadas TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS observacoes_operacionais TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS servicos_contratados TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS contrato_url TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS mensalidade NUMERIC;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS vencimento_dia INTEGER;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS financeiro_notas TEXT;

