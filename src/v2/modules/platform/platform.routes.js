const express = require('express');
const router = express.Router();
const service = require('./platform.service');

router.post('/bootstrap-tenant', async (req, res) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Nome do tenant é obrigatório' });
        }
        
        const result = await service.bootstrapTenant(userId, name);
        res.status(201).json(result);
    } catch (error) {
        console.error('Bootstrap Tenant Error:', error);
        res.status(500).json({ error: 'Erro ao criar tenant' });
    }
});

module.exports = router;
