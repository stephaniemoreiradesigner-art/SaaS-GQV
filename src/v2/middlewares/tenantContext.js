const supabase = require('../core/supabase');

const tenantContext = async (req, res, next) => {
  try {
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
      const membership = memberships.find(m => String(m.tenant_id) === String(requestedTenantId));
      
      if (membership) {
        activeTenantId = membership.tenant_id;
        activeRole = membership.role;
      } else if (profile && String(profile.tenant_id) === String(requestedTenantId)) {
        activeTenantId = profile.tenant_id;
        activeRole = profile.role;
      } else {
        // Se for admin global, talvez possa acessar? Por enquanto bloqueamos.
        return res.status(403).json({ error: 'Acesso negado ao tenant solicitado' });
      }
    } else {
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
