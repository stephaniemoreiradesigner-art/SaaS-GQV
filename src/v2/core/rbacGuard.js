const permissions = {
  'super_admin': ['*'],
  'admin': ['*'],
  'colaborador': ['read:dashboard', 'write:posts', 'read:tenant'],
  'social_media': ['read:dashboard', 'write:posts', 'read:tenant'],
  'gestor_trafego': ['read:dashboard', 'write:ads', 'read:tenant'],
  'financeiro': ['read:dashboard', 'read:finance', 'read:tenant']
};

const rbacGuard = (requiredPermission) => {
  return (req, res, next) => {
    const userRole = req.userRole;

    if (!userRole) {
      return res.status(403).json({ error: 'Acesso negado: Perfil não identificado' });
    }

    const userPermissions = permissions[userRole] || [];

    if (userPermissions.includes('*')) {
      return next();
    }

    if (userPermissions.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({ error: `Acesso negado: Permissão '${requiredPermission}' necessária` });
  };
};

module.exports = rbacGuard;
