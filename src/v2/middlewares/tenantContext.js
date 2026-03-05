const supabase = require('../core/supabase');

const tenantContext = async (req, res, next) => {
  try {
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured for v2' });
    }

    const userId = req.user.id;
    const requestedTenantId = req.headers['x-tenant-id'];

    // Busca paralela de perfil, memberships e dados de colaborador
    const [profileRes, membershipsRes, collaboratorRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('memberships').select('*').eq('user_id', userId),
      supabase.from('colaboradores').select('*').eq('user_id', userId).maybeSingle()
    ]);

    const profile = profileRes.data;
    const memberships = membershipsRes.data || [];
    const collaborator = collaboratorRes.data;

    let activeTenantId = null;
    let activeRole = null;

    // Estratégia de resolução de tenant:
    // 1. Se cabeçalho X-Tenant-ID for enviado, verifica se o usuário tem acesso
    // 2. Se não, usa o tenant_id do profile (tenant principal)
    // 3. Se não, usa o primeiro tenant encontrado em memberships

    if (requestedTenantId) {
      // Hardening: Apenas admin da plataforma pode forçar tenant via header
      const isPlatformAdmin = profile?.role === 'super_admin'; 
      
      if (!isPlatformAdmin) {
         console.warn(`[TenantContext] Tentativa de switch de tenant por usuário não-admin: ${userId}`);
         return res.status(403).json({ 
             error: 'Uso de X-Tenant-ID restrito a administradores da plataforma',
             code: 'FORBIDDEN_HEADER'
         });
      }

      console.log(`[TenantContext] Admin ${userId} acessando tenant ${requestedTenantId}`);
      activeTenantId = requestedTenantId;
      activeRole = 'super_admin'; 
      
    } else {
      // Resolução padrão segura
      if (profile && profile.tenant_id) {
        activeTenantId = profile.tenant_id;
        activeRole = profile.role;
      } else if (memberships.length > 0) {
        activeTenantId = memberships[0].tenant_id;
        activeRole = memberships[0].role;
      }
    }

    req.tenantId = activeTenantId;
    req.userRole = activeRole; // Role no contexto do tenant ativo
    req.collaboratorId = collaborator?.id;
    req.profile = profile;

    next();
  } catch (err) {
    console.error('Tenant context error:', err);
    return res.status(500).json({ error: 'Erro ao resolver contexto do tenant' });
  }
};

module.exports = tenantContext;
