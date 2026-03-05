const supabase = require('../core/supabase');

const tenantContext = async (req, res, next) => {
  try {
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured for v2' });
    }

    const userId = req.user.id;
    const requestedTenantId = req.headers['x-tenant-id'];

    // Buscar memberships na nova estrutura v2
    // Assumindo que a relação tenant_member_roles -> roles está configurada corretamente no Supabase
    const { data: memberships, error } = await supabase
        .from('tenant_memberships')
        .select(`
            id, 
            tenant_id, 
            tenant_member_roles (
                roles (
                    key
                )
            )
        `)
        .eq('user_id', userId);

    if (error) {
        console.error('Erro ao buscar memberships:', error);
        throw error;
    }

    const validMemberships = memberships || [];

    let activeTenantId = null;
    let activeMembershipId = null;
    let activeRoles = [];

    if (requestedTenantId) {
        // Verifica se o usuário tem membership no tenant solicitado
        const targetMembership = validMemberships.find(m => m.tenant_id === requestedTenantId);
        
        if (targetMembership) {
            activeTenantId = targetMembership.tenant_id;
            activeMembershipId = targetMembership.id;
            activeRoles = targetMembership.tenant_member_roles.map(tmr => tmr.roles?.key).filter(Boolean);
        } else {
             return res.status(403).json({ 
                 error: 'Acesso negado ao tenant solicitado',
                 code: 'FORBIDDEN_TENANT'
             });
        }
    } else {
        // Pega o primeiro tenant disponível
        if (validMemberships.length > 0) {
            activeTenantId = validMemberships[0].tenant_id;
            activeMembershipId = validMemberships[0].id;
            activeRoles = validMemberships[0].tenant_member_roles.map(tmr => tmr.roles?.key).filter(Boolean);
        }
    }

    req.tenant = {
        tenant_id: activeTenantId,
        membership_id: activeMembershipId,
        roles: activeRoles
    };
    
    // Manter compatibilidade com código legado se houver
    req.tenantId = activeTenantId;

    next();
  } catch (err) {
    console.error('Tenant context error:', err);
    return res.status(500).json({ error: 'Erro ao resolver contexto do tenant' });
  }
};

module.exports = tenantContext;
