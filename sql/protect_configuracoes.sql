-- Habilita RLS na tabela de configurações
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Garante que todos os usuários autenticados possam LER as configurações
-- (Necessário para carregar o tema, chaves de API públicas, etc.)
CREATE POLICY "Permitir Leitura para Todos" 
ON configuracoes FOR SELECT 
TO authenticated 
USING (true);

-- Permite INSERT/UPDATE apenas para Super Admins e Admins
-- Baseado na tabela 'profiles' que o app.js sincroniza
CREATE POLICY "Permitir Edição Apenas Admins" 
ON configuracoes FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('super_admin', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('super_admin', 'admin')
  )
);
