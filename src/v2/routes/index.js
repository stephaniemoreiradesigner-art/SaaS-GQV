const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const tenantContext = require('../middlewares/tenantContext');
const testRouter = require('./test.routes');

// Health check (Público)
router.get('/health', (req, res) => {
  res.status(200).json({ 
    ok: true, 
    version: 'v2',
    timestamp: new Date().toISOString()
  });
});

// Rotas de Teste e Validação
router.use('/test', testRouter);

// Middlewares globais para rotas protegidas (A partir daqui)
// Todas as rotas abaixo requerem autenticação e contexto de tenant
router.use(authMiddleware);
router.use(tenantContext);

// Endpoint piloto: Contexto do usuário/tenant
router.get('/me/tenant', (req, res) => {
  res.status(200).json({
    user_id: req.user.id,
    tenant_id: req.tenantId,
    collaborator_id: req.collaboratorId,
    role: req.userRole,
    email: req.user.email,
    profile: req.profile
  });
});

// Exemplo de uso de Guards (comentado para referência)
// router.get('/admin/stats', rbacGuard('read:dashboard'), planGuard('analytics'), (req, res) => { ... });

module.exports = router;
