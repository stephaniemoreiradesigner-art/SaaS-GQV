-- Add specialized caption columns to social_posts
ALTER TABLE public.social_posts 
ADD COLUMN IF NOT EXISTS legenda_linkedin TEXT,
ADD COLUMN IF NOT EXISTS legenda_tiktok TEXT;
