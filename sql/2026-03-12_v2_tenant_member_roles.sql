CREATE TABLE IF NOT EXISTS public.tenant_member_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    membership_id uuid NOT NULL REFERENCES public.tenant_memberships(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_member_roles_membership_role_unique
ON public.tenant_member_roles (membership_id, role_id);

CREATE INDEX IF NOT EXISTS tenant_member_roles_membership_id_idx
ON public.tenant_member_roles (membership_id);

CREATE INDEX IF NOT EXISTS tenant_member_roles_role_id_idx
ON public.tenant_member_roles (role_id);
