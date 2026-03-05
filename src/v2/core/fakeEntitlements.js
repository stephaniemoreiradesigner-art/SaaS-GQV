// Mock temporário para controle de features por tenant
// Simula entitlements (direitos de uso) baseados em planos/addons

const entitlements = {
  // Tenant A: Plano Pro com AI
  'tenant-a': {
    features: ['feature.ai', 'analytics.advanced', 'api.access'],
    plan: 'pro'
  },
  
  // Tenant B: Plano Basic sem AI
  'tenant-b': {
    features: ['analytics.basic'],
    plan: 'basic'
  },
  
  // Default para tenants não listados
  'default': {
    features: [],
    plan: 'free'
  }
};

const getEntitlements = (tenantId) => {
  // Se for numérico, converte para string para busca
  const tid = String(tenantId);
  
  // Retorna configuração específica ou default
  return entitlements[tid] || entitlements['default'];
};

const hasFeature = (tenantId, featureKey) => {
  const ent = getEntitlements(tenantId);
  return ent.features.includes(featureKey);
};

module.exports = {
  getEntitlements,
  hasFeature
};
