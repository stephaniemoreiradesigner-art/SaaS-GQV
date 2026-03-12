const repo = require('./platform.repo');

const bootstrapTenant = async (userId, tenantName) => {
    // 1. Criar tenant
    const tenant = await repo.createTenant(tenantName);
    
    // 2. Criar membership
    const membership = await repo.createMembership(tenant.id, userId);
    
    // 3. Garantir role owner
    let role = await repo.getRoleByName('owner');
    if (!role) {
        try {
            role = await repo.createRole('owner', 'Owner');
        } catch (error) {
            role = await repo.getRoleByName('owner');
            if (!role) throw error;
        }
    }
    
    // 4. Atribuir role ao membro
    try {
        await repo.assignRoleToMember(membership.id, role.id);
    } catch (error) {
        const message = String(error?.message || '');
        if (!/duplicate/i.test(message)) throw error;
    }
    
    // 5. Criar entitlements padrão
    const defaultEntitlements = {
        feature_ai: true,
        feature_social: true,
        feature_ads: true
    };
    try {
        await repo.createEntitlements(tenant.id, defaultEntitlements);
    } catch (error) {
        const message = String(error?.message || '');
        if (!/duplicate/i.test(message)) throw error;
    }
    
    return {
        tenant_id: tenant.id,
        membership_id: membership.id,
        role: 'owner'
    };
};

module.exports = {
    bootstrapTenant
};
