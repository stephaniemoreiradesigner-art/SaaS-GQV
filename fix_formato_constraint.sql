-- Remover a restrição restritiva da coluna formato
-- Isso permite salvar "Carrossel Instagram", "Reels", etc. sem dar erro.
ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_formato_check;

-- Opcional: Se quiser garantir apenas valores válidos no futuro, descomente abaixo.
-- Mas para IA, é melhor deixar aberto (TEXT livre) e tratar no frontend.
-- ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_formato_check CHECK (formato IN ('estatico', 'reels', 'carrossel', 'stories', 'video'));
