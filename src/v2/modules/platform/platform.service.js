const repo = require('./platform.repo');

const bootstrapTenant = async (userId, tenantName) => {
    // 1. Criar tenant
    const tenant = await repo.createTenant(tenantName);
    
    // 2. Criar membership
    const membership = await repo.createMembership(tenant.id, userId);
    
    // 3. Garantir role owner
    let role = await repo.getRoleByName('owner');
    if (!role) {
        role = await repo.createRole('owner', 'Owner');
    }
    
    // 4. Atribuir role ao membro
    await repo.assignRoleToMember(membership.id, role.id);
    
    // 5. Criar entitlements padrão
    const defaultEntitlements = {
        feature_ai: true,
        feature_social: true,
        feature_ads: true
    };
    await repo.createEntitlements(tenant.id, defaultEntitlements);
    
    return {
        tenant_id: tenant.id,
        membership_id: membership.id,
        role: 'owner'
    };
};

module.exports = {
    bootstrapTenant
};
