const express = require('express');
const router = express.Router();
const supabase = require('../core/supabase');

const authMiddleware = require('../middlewares/authMiddleware');
const tenantContext = require('../middlewares/tenantContext');

// Aplica middlewares básicos para todas as rotas de teste
router.use(authMiddleware);
router.use(tenantContext);

// GET /api/v2/test/context
router.get('/context', async (req, res) => {
  const tenant = req.tenant || {};
  
  let entitlements = {};
  if (tenant.tenant_id) {
      const { data } = await supabase
          .from('tenant_entitlements')
          .select('*')
          .eq('tenant_id', tenant.tenant_id)
          .maybeSingle();
      entitlements = data || {};
  }

  console.log(`[TEST] Context requested by ${req.user.email} (Tenant: ${tenant.tenant_id})`);

  res.json({
    user_id: req.user.id,
    tenant_id: tenant.tenant_id,
    membership_id: tenant.membership_id,
    roles: tenant.roles || [],
    entitlements: entitlements
  });
});

module.exports = router;
