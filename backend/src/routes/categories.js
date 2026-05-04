const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

// GET /api/categories — Public: Get all active categories
router.get('/', async (req, res) => {
  try {
    let tenantId = req.headers['x-tenant-id'] ? parseInt(req.headers['x-tenant-id']) : 1;
    const tenantSlug = req.headers['x-tenant-slug'];

    if (tenantSlug && tenantSlug !== 'project-million') {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }

    const categories = await prisma.category.findMany({
      where: { active: true, tenantId: tenantId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } }
    });
    res.setHeader('X-Debug-Tenant-ID', tenantId.toString());
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load categories.' });
  }
});

// POST /api/categories — Admin: Create category
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });

    const maxSort = await prisma.category.aggregate({ 
      where: { tenantId: req.user.tenantId },
      _max: { sortOrder: true } 
    });
    const category = await prisma.category.create({
      data: { 
        tenantId: req.user.tenantId,
        name, 
        description, 
        icon: icon || '🍔', 
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        active: true
      }
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create category.' });
  }
});

// PUT /api/categories/:id — Admin: Update category
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, icon, active, sortOrder } = req.body;
    const category = await prisma.category.update({
      where: { id: parseInt(req.params.id), tenantId: req.user.tenantId },
      data: { name, description, icon, active, sortOrder }
    });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update category.' });
  }
});

// DELETE /api/categories/:id — Admin: Delete category
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await prisma.category.update({
      where: { id: parseInt(req.params.id), tenantId: req.user.tenantId },
      data: { active: false }
    });
    res.json({ success: true, message: 'Category deactivated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete category.' });
  }
});

module.exports = router;
