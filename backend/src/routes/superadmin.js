const express = require('express');
const router = express.Router();
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

// POST /api/superadmin/tenants
router.post('/tenants', async (req, res) => {
  try {
    const { name, slug, primaryColor, logo, bannerImage } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'Name and slug are required' });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        primaryColor: primaryColor || '#f97316',
        logo,
        bannerImage
      }
    });

    res.status(201).json({ success: true, data: tenant });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Slug already exists' });
    }
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
