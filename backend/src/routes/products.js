const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/products/tenant/:slug
router.get('/tenant/:slug', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug }
    });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });
    res.json({ 
      success: true, 
      data: { 
        name: tenant.name, 
        slug: tenant.slug,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        bannerImage: tenant.bannerImage
      } 
    });
  } catch (error) {
    console.error('❌ Error fetching tenant:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch tenant.', error: error.message });
  }
});

// GET /api/products — Public: Get all available products grouped by category
router.get('/', async (req, res) => {
  try {
    let tenantId = req.headers['x-tenant-id'] ? parseInt(req.headers['x-tenant-id']) : 1;
    const tenantSlug = req.headers['x-tenant-slug'];

    // If we have a slug but the ID is default, let's find the real ID for that slug
    if (tenantSlug && tenantSlug !== 'project-million') {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }

    const categories = await prisma.category.findMany({
      where: { active: true, tenantId: tenantId },
      orderBy: { sortOrder: 'asc' },
      include: { 
        products: { 
          where: { available: true, tenantId: tenantId },
          include: { category: true, addons: true },
          orderBy: { sortOrder: 'asc' }
        } 
      }
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    res.setHeader('X-Debug-Tenant-ID', tenantId.toString());
    res.json({ 
      success: true, 
      data: categories, 
      tenantName: tenant?.name,
      branding: {
        primaryColor: tenant?.primaryColor,
        secondaryColor: tenant?.secondaryColor,
        bannerImage: tenant?.bannerImage
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Failed to load products.' });
  }
});

// GET /api/products/:id — Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        category: true,
        addons: { where: { available: true } }
      }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Failed to load product.' });
  }
});

module.exports = router;
