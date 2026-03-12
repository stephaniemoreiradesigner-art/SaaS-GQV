const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const tenantContext = require('../middlewares/tenantContext');
const testRouter = require('./test.routes');
const platformRouter = require('../modules/platform/platform.routes');

// Health check (Público)
router.get('/health', (req, res) => {
  res.status(200).json({ 
    ok: true, 
    version: 'v2',
    timestamp: new Date().toISOString()
  });
});

// Rotas de Plataforma (Bootstrap) - Requer Auth, mas NÃO Tenant Context
router.use('/platform', authMiddleware, platformRouter);

// Rotas de Teste e Validação
router.use('/test', testRouter);

// Middlewares globais para rotas protegidas DE TENANT (A partir daqui)
// Todas as rotas abaixo requerem autenticação e contexto de tenant
router.use(authMiddleware);
router.use(tenantContext);

// Endpoint piloto: Contexto do usuário/tenant
router.get('/me/tenant', (req, res) => {
  const tenant = req.tenant || {};
  res.status(200).json({
    user_id: req.user.id,
    tenant_id: tenant.tenant_id,
    membership_id: tenant.membership_id,
    roles: tenant.roles,
    email: req.user.email
  });
});

router.get('/me', (req, res) => {
  const tenant = req.tenant || {};
  res.status(200).json({
    user_id: req.user.id,
    tenant_id: tenant.tenant_id,
    membership_id: tenant.membership_id,
    roles: tenant.roles,
    email: req.user.email
  });
});

module.exports = router;
