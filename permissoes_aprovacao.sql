-- Habilitar RLS na tabela social_posts (boas práticas)
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- Remover política anterior se existir para evitar erro de duplicidade
DROP POLICY IF EXISTS "Publico pode ver posts em aprovação" ON social_posts;

-- Criar política para permitir que QUALQUER PESSOA (mesmo sem login) veja os posts que têm um grupo de aprovação
CREATE POLICY "Publico pode ver posts em aprovação"
ON social_posts
FOR SELECT
TO public
USING (approval_group_id IS NOT NULL);

-- Habilitar RLS na tabela configuracoes
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Remover política anterior se existir
DROP POLICY IF EXISTS "Publico pode ver branding" ON configuracoes;

-- Criar política para permitir que o cliente veja o logo e cores (White Label)
CREATE POLICY "Publico pode ver branding"
ON configuracoes
FOR SELECT
TO public
USING (key IN ('white_label_primary_color', 'white_label_secondary_color', 'white_label_logo_url', 'white_label_favicon_url'));
