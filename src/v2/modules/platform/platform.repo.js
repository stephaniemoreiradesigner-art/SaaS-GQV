const supabase = require('../../core/supabase');

const createTenant = async (name) => {
    const { data, error } = await supabase
        .from('tenants')
        .insert({ name })
        .select('id')
        .single();

    if (error) throw error;
    return data;
};

const createMembership = async (tenantId, userId) => {
    const { data, error } = await supabase
        .from('tenant_memberships')
        .insert({ tenant_id: tenantId, user_id: userId })
        .select('id')
        .single();

    if (error) throw error;
    return data;
};

const getRoleByName = async (roleName) => {
    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('key', roleName)
        .maybeSingle();
    
    if (error) throw error;
    return data;
};

const createRole = async (key, name) => {
    const { data, error } = await supabase
        .from('roles')
        .insert({ key, name })
        .select('id')
        .single();

    if (error) throw error;
    return data;
};

const assignRoleToMember = async (membershipId, roleId) => {
    const { error } = await supabase
        .from('tenant_member_roles')
        .insert({ membership_id: membershipId, role_id: roleId });

    if (error) throw error;
};

const createEntitlements = async (tenantId, entitlements) => {
    const { error } = await supabase
        .from('tenant_entitlements')
        .insert({ tenant_id: tenantId, ...entitlements });

    if (error) throw error;
};

module.exports = {
    createTenant,
    createMembership,
    getRoleByName,
    createRole,
    assignRoleToMember,
    createEntitlements
};
