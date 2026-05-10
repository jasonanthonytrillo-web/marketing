const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// All routes here require superadmin
router.use(authenticate, authorize('superadmin'));

// GET /api/superadmin/tenants
router.get('/tenants', async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true, orders: true, products: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: tenants });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load tenants' });
  }
});

// POST /api/superadmin/tenants — Creates tenant + initial admin account atomically
router.post('/tenants', async (req, res) => {
  try {
    const { name, slug, primaryColor, logo, bannerImage, adminEmail, adminPassword, adminName } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'Name and slug are required' });
    }

    if (!adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, message: 'Admin email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Use a transaction to create both tenant + admin atomically
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          primaryColor: primaryColor || '#f97316',
          logo,
          bannerImage
        }
      });

      const admin = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName || `${name} Admin`,
          role: 'admin',
          active: true,
          tenantId: tenant.id
        }
      });

      return { tenant, admin };
    });

    res.status(201).json({ 
      success: true, 
      data: result.tenant,
      admin: { email: result.admin.email, name: result.admin.name }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Slug or admin email already exists' });
    }
    console.error('Provision tenant error:', error);
    res.status(500).json({ success: false, message: 'Failed to create tenant' });
  }
});

// PATCH /api/superadmin/tenants/:id
router.patch('/tenants/:id', async (req, res) => {
  try {
    const { active, name, primaryColor } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: parseInt(req.params.id) },
      data: { active, name, primaryColor }
    });
    res.json({ success: true, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update tenant' });
  }
});

module.exports = router;
