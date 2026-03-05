const { hasFeature, getEntitlements } = require('./fakeEntitlements');

const planGuard = (featureKey) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenantId || 'default';
      const entitlements = getEntitlements(tenantId);
      
      console.log(`[PlanGuard] Verificando feature '${featureKey}' para tenant '${tenantId}' (Plan: ${entitlements.plan})`);
      
      if (!hasFeature(tenantId, featureKey)) {
        console.warn(`[PlanGuard] BLOQUEADO: Tenant '${tenantId}' não tem feature '${featureKey}'`);
        return res.status(403).json({ 
            error: `Feature '${featureKey}' não disponível no plano '${entitlements.plan}'`,
            code: 'PLAN_LIMIT_REACHED',
            required_feature: featureKey,
            current_plan: entitlements.plan
        });
      }

      next();
    } catch (err) {
      console.error('PlanGuard error:', err);
      res.status(500).json({ error: 'Erro ao verificar plano' });
    }
  };
};

module.exports = planGuard;
