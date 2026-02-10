-- FIX: Corrigir erro 500 na tabela profiles (Recursão Infinita em Políticas RLS)

-- 1. Garantir que a tabela existe com a estrutura correta
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at timestamp with time zone DEFAULT now(),
  username text UNIQUE,
  full_name text,
  avatar_url text,
  website text,
  role text DEFAULT 'usuario',
  tenant_id bigint REFERENCES public.clientes(id)
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Remover TODAS as políticas antigas para limpar conflitos (Várias tentativas de nomes comuns)
-- Adicionei "Users can insert own profile" que estava faltando no DROP anterior
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles; 
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;

-- 4. Criar políticas limpas e seguras

-- PERMISSÃO DE LEITURA:
-- O usuário pode ver APENAS o seu próprio perfil
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- PERMISSÃO DE ATUALIZAÇÃO:
-- O usuário pode editar APENAS o seu próprio perfil
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- PERMISSÃO DE INSERÇÃO:
-- O usuário pode criar seu próprio perfil (necessário para o primeiro login)
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- 5. Trigger para criar perfil automaticamente ao cadastrar usuário (Boas Práticas)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role, tenant_id)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url', 
    COALESCE(new.raw_user_meta_data->>'role', 'usuario'),
    CASE
      WHEN (new.raw_user_meta_data->>'tenant_id') ~ '^\d+$' THEN (new.raw_user_meta_data->>'tenant_id')::bigint
      WHEN (new.raw_user_meta_data->>'cliente_id') ~ '^\d+$' THEN (new.raw_user_meta_data->>'cliente_id')::bigint
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Garantir permissões básicas de Grant
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
