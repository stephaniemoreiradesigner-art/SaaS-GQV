const planGuard = (featureKey) => {
  return async (req, res, next) => {
    try {
      // TODO: Implementar verificação real de plano/features
      // Por enquanto, apenas loga e permite
      // No futuro, verificar req.tenant.plan ou tabela subscriptions
      
      console.log(`[PlanGuard] Verificando feature: ${featureKey} para tenant: ${req.tenantId}`);
      
      // Simulação: Bloquear feature 'premium_analytics' para tenant ID 0 (exemplo)
      if (featureKey === 'premium_analytics' && req.tenantId === '0') {
          return res.status(403).json({ 
              error: 'Feature não disponível no plano atual',
              code: 'PLAN_LIMIT_REACHED'
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
