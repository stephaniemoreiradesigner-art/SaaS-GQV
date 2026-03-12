const supabase = require('../core/supabase');
const platformService = require('../modules/platform/platform.service');

const tenantContext = async (req, res, next) => {
  try {
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured for v2' });
    }

    const userId = req.user.id;
    const requestedTenantId = req.headers['x-tenant-id'];

    const fetchMemberships = async () => {
        return await supabase
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
    };

    // Buscar memberships na nova estrutura v2
    // Assumindo que a relação tenant_member_roles -> roles está configurada corretamente no Supabase
    let { data: memberships, error } = await fetchMemberships();

    if (error) {
        console.error('Erro ao buscar memberships:', error);
        throw error;
    }

    let validMemberships = memberships || [];

    if (!validMemberships.length) {
        const shouldAutoBootstrap = process.env.V2_AUTO_BOOTSTRAP_TENANT !== 'false';
        if (shouldAutoBootstrap) {
            const email = String(req.user?.email || '').trim();
            const baseName = email ? email.split('@')[0] : String(userId).slice(0, 8);
            const tenantName = `Workspace ${baseName}`.trim().slice(0, 120);
            try {
                await platformService.bootstrapTenant(userId, tenantName || 'Workspace');
            } catch (bootstrapError) {
                console.error('[tenantContext] Auto-bootstrap falhou:', bootstrapError);
            }

            const refetch = await fetchMemberships();
            if (!refetch.error) {
                validMemberships = refetch.data || [];
            }
        }
    }

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

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const tenantUuid = activeTenantId && UUID_RE.test(String(activeTenantId)) ? String(activeTenantId) : null;
    const tenantIdLegacy = !tenantUuid && activeTenantId && String(activeTenantId).match(/^-?\d+$/) ? Number(activeTenantId) : null;

    req.tenant = {
        tenant_id: activeTenantId,
        tenantUuid,
        tenantId: tenantIdLegacy,
        membership_id: activeMembershipId,
        roles: activeRoles
    };
    
    // Manter compatibilidade com código legado se houver
    req.tenantId = activeTenantId;
    req.tenantUuid = tenantUuid;
    req.tenantIdLegacy = tenantIdLegacy;

    console.log('[tenantContext] Resolved:', { tenantId: tenantIdLegacy, tenantUuid, userId });

    next();
  } catch (err) {
    console.error('Tenant context error:', err);
    return res.status(500).json({ error: 'Erro ao resolver contexto do tenant' });
  }
};

module.exports = tenantContext;
