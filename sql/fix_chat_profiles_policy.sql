-- Fix for Chat Module: Allow authenticated users to see basic profile info
-- This is required so users can find each other's Auth IDs by email to start Direct Messages.

-- 1. Drop existing restrictive policies if necessary (optional, but good for cleanup)
-- DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
-- DROP POLICY IF EXISTS "Super Admins veem todos os perfis" ON public.profiles;

-- 2. Create a policy that allows any authenticated user to read profiles
-- We restrict this to SELECT only.
CREATE POLICY "Permitir leitura de perfis para autenticados" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Note: If you want to restrict which columns they can see, you can't do it easily with RLS alone in Supabase (Postgres),
-- but the client-side code only selects 'id' and 'email'.
