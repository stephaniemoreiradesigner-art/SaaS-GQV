-- Ensure social media columns exist in clientes table
-- This fixes the issue where code expects these columns for Insights

DO $$
BEGIN
    -- Add instagram_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'instagram_id') THEN
        ALTER TABLE public.clientes ADD COLUMN instagram_id TEXT;
    END IF;

    -- Add facebook_page_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'facebook_page_id') THEN
        ALTER TABLE public.clientes ADD COLUMN facebook_page_id TEXT;
    END IF;
END $$;
