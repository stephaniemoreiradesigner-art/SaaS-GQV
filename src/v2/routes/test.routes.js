const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const tenantContext = require('../middlewares/tenantContext');
const rbacGuard = require('../core/rbacGuard');
const planGuard = require('../core/planGuard');
const { getEntitlements } = require('../core/fakeEntitlements');

// Aplica middlewares básicos para todas as rotas de teste
// Nota: Em index.js, testRouter é montado ANTES dos middlewares globais
// para permitir testes isolados se necessário, mas aqui reaplicamos
// para garantir segurança.
router.use(authMiddleware);
router.use(tenantContext);

// GET /api/v2/test/context
// Retorna { user_id, tenant_id, roles, plan }
router.get('/context', (req, res) => {
  const tenantId = req.tenantId;
  const entitlements = getEntitlements(tenantId);

  console.log(`[TEST] Context requested by ${req.user.email} (Tenant: ${tenantId}, Role: ${req.userRole})`);

  res.json({
    user_id: req.user.id,
    tenant_id: tenantId,
    roles: [req.userRole],
    plan: entitlements.plan,
    features: entitlements.features,
    is_platform_admin: req.profile?.role === 'super_admin'
  });
});

// GET /api/v2/test/admin-only
// Requer role 'owner' (ou super_admin, que tem acesso a tudo)
// OBS: No fakeEntitlements/rbacGuard, owner não estava explicitamente mapeado, 
// vou usar 'super_admin' ou 'admin' que mapeei no rbacGuard anterior.
// O prompt pede rbacGuard('owner'). Vou precisar ajustar o rbacGuard ou usar 'admin'.
// Vou assumir que o usuário quis dizer 'admin' ou que devo adicionar 'owner'.
// Como o prompt foi específico "rbacGuard('owner')", vou adicionar 'owner' ao rbacGuard ou usar 'admin' e comentar.
// Olhando o rbacGuard.js anterior: 'super_admin' e 'admin' têm ['*'].
// Vou usar 'admin' aqui para garantir funcionamento com o código existente,
// ou adicionar 'owner' ao rbacGuard.js se necessário. 
// O prompt diz: "GET /api/v2/test/admin-only (auth + tenant + rbacGuard('owner'))".
// Vou usar rbacGuard('owner') e atualizar o rbacGuard.js para suportar 'owner' (alias para admin ou similar).

router.get('/admin-only', rbacGuard('owner'), (req, res) => {
  console.log(`[TEST] Admin-only route accessed by ${req.user.email}`);
  res.json({ ok: true, message: 'Welcome Admin/Owner' });
});

// GET /api/v2/test/feature-ai
// Requer feature 'feature.ai'
router.get('/feature-ai', planGuard('feature.ai'), (req, res) => {
  console.log(`[TEST] AI Feature accessed by ${req.user.email}`);
  res.json({ ok: true, message: 'AI Feature Access Granted' });
});

module.exports = router;
