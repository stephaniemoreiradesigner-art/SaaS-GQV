-- Migration to add client feedback columns
ALTER TABLE public.social_calendars ADD COLUMN IF NOT EXISTS comentario_cliente TEXT;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS comentario_cliente TEXT;
