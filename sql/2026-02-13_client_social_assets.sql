CREATE TABLE IF NOT EXISTS public.client_social_assets (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    time_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    asset_name TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT client_social_assets_unique UNIQUE (client_id, provider, asset_type, asset_id)
);
