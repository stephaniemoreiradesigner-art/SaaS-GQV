CREATE TABLE IF NOT EXISTS public.client_selected_assets (
    client_id BIGINT PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
    time_id UUID NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
    meta_page_id TEXT,
    meta_page_name TEXT,
    meta_page_access_token TEXT,
    meta_ig_user_id TEXT,
    meta_ig_username TEXT,
    linkedin_org_id TEXT,
    linkedin_org_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);
