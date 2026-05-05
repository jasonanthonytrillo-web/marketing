const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true }
    });

    if (!user || !user.active) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive account.' });
    }

    // BLOCK SUSPENDED TENANTS
    if (user.role !== 'superadmin' && user.tenant && !user.tenant.active) {
      return res.status(403).json({ success: false, message: 'This store is currently suspended. Please contact support.' });
    }

    // TENANT ISOLATION: 
    // Ensure the tenant context matches the user's tenant
    const headerTenantId = req.headers['x-tenant-id'];
    if (user.role !== 'superadmin' && headerTenantId) {
      if (parseInt(headerTenantId) !== user.tenantId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Security Alert: You are not authorized to access this store context.' 
        });
      }
    }

    req.user = user;
    // Always use the user's tenantId for security, ignore the header if not superadmin
    req.tenantId = user.role === 'superadmin' ? (parseInt(headerTenantId) || user.tenantId) : user.tenantId;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (roles.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
  };
};

module.exports = { authenticate, authorize };
