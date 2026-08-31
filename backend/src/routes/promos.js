const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');

// Public endpoint to validate and calculate promo code
router.post('/validate', async (req, res) => {
  try {
    const { tenantSlug, code, items, customerId } = req.body; // items = [{ productId, quantity, price, categoryId }]

    if (!tenantSlug || !code || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // RESTRICTION: Promo codes are exclusively for registered members (no guests)
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Promo codes are exclusively available for registered members. Please log in or create an account to use discount codes.'
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug }
    });

    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    
    // Check if Super Admin killed the promo system
    if (tenant.saPromoDisabled) {
      return res.status(400).json({ success: false, message: 'Promotions are currently disabled for this store.' });
    }

    // Verify customer exists and is active
    const customer = await prisma.user.findUnique({
      where: { id: parseInt(customerId, 10) }
    });

    if (!customer || !customer.active) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer account. Please log in to apply promo codes.'
      });
    }

    const promo = await prisma.promoCode.findUnique({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: code.toUpperCase()
        }
      }
    });

    if (!promo || !promo.isActive) {
      return res.status(400).json({ success: false, message: 'Invalid or expired promo code' });
    }

    // Check dates
    const now = new Date();
    if (promo.startDate && now < promo.startDate) {
      return res.status(400).json({ success: false, message: 'This promo code is not yet active.' });
    }
    if (promo.endDate && now > promo.endDate) {
      return res.status(400).json({ success: false, message: 'This promo code has expired.' });
    }

    // Check global usage limits
    if (promo.maxUses && promo.currentUses >= promo.maxUses) {
      return res.status(400).json({ success: false, message: 'This promo code has reached its overall usage limit.' });
    }

    // Check per-user usage limits
    if (promo.maxUsesPerUser && promo.maxUsesPerUser > 0) {
      const userPromoUses = await prisma.order.count({
        where: {
          tenantId: tenant.id,
          customerId: customer.id,
          discountType: 'promo',
          status: { not: 'cancelled' },
          OR: [
            { promoCode: promo.code },
            { notes: { contains: `Promo: ${promo.code}` } }
          ]
        }
      });

      if (userPromoUses >= promo.maxUsesPerUser) {
        return res.status(400).json({
          success: false,
          message: `You have reached your personal usage limit (${promo.maxUsesPerUser} time${promo.maxUsesPerUser > 1 ? 's' : ''}) for this promo code.`
        });
      }
    }

    let subtotal = 0;
    let applicableSubtotal = 0;

    // Fetch product details for all items from DB to reliably identify category & product
    const productIds = items
      .map(item => parseInt(item.productId || item.id, 10))
      .filter(id => !isNaN(id));

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Calculate how much of the cart applies to the discount
    items.forEach(item => {
      const pid = parseInt(item.productId || item.id, 10);
      const product = productMap.get(pid);
      const categoryId = item.categoryId ? parseInt(item.categoryId, 10) : (product ? product.categoryId : null);

      const itemTotal = parseFloat(item.price) * parseInt(item.quantity, 10);
      subtotal += itemTotal;

      let isApplicable = false;
      if (promo.appliesTo === 'ALL') {
        isApplicable = true;
      } else if (promo.appliesTo === 'PRODUCT' && promo.targetId && parseInt(promo.targetId, 10) === pid) {
        isApplicable = true;
      } else if (promo.appliesTo === 'CATEGORY' && promo.targetId && (
        (categoryId && parseInt(promo.targetId, 10) === parseInt(categoryId, 10)) ||
        (product && parseInt(promo.targetId, 10) === parseInt(product.categoryId, 10))
      )) {
        isApplicable = true;
      }

      if (isApplicable) {
        applicableSubtotal += itemTotal;
      }
    });

    if (applicableSubtotal === 0) {
      return res.status(400).json({ success: false, message: 'This promo code does not apply to any items in your cart.' });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.type === 'PERCENTAGE') {
      discountAmount = applicableSubtotal * (promo.value / 100);
    } else if (promo.type === 'FIXED') {
      // Don't discount more than the applicable amount
      discountAmount = Math.min(applicableSubtotal, promo.value);
    }

    // Round to 2 decimals
    const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    discountAmount = round2(discountAmount || 0);

    // Return the response without applying it, just so frontend can display
    res.json({
      success: true,
      data: {
        promoId: promo.id,
        code: promo.code,
        discountAmount: discountAmount
      }
    });

  } catch (error) {
    console.error('Validate promo error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin endpoints (require auth & admin)
router.use(authenticate, authorize('admin'));

// GET /api/promos
router.get('/', async (req, res) => {
  try {
    const promos = await prisma.promoCode.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: promos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch promos' });
  }
});

// POST /api/promos
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    data.tenantId = req.user.tenantId;
    data.code = data.code.toUpperCase();
    
    // Check if code exists
    const existing = await prisma.promoCode.findUnique({
      where: {
        tenantId_code: {
          tenantId: req.user.tenantId,
          code: data.code
        }
      }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'A promo code with this name already exists' });
    }

    const promo = await prisma.promoCode.create({
      data: {
        tenantId: req.user.tenantId,
        code: data.code,
        type: data.type,
        value: parseFloat(data.value),
        appliesTo: data.appliesTo || 'ALL',
        targetId: data.targetId ? parseInt(data.targetId, 10) : null,
        maxUses: data.maxUses ? parseInt(data.maxUses, 10) : null,
        maxUsesPerUser: data.maxUsesPerUser ? parseInt(data.maxUsesPerUser, 10) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    res.status(201).json({ success: true, data: promo });
  } catch (error) {
    console.error('Create promo error:', error);
    res.status(500).json({ success: false, message: 'Failed to create promo code' });
  }
});

// PUT /api/promos/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    if (data.code) data.code = data.code.toUpperCase();
    if (data.value) data.value = parseFloat(data.value);
    if (data.targetId !== undefined) data.targetId = data.targetId ? parseInt(data.targetId, 10) : null;
    if (data.maxUses !== undefined) data.maxUses = data.maxUses ? parseInt(data.maxUses, 10) : null;
    if (data.maxUsesPerUser !== undefined) data.maxUsesPerUser = data.maxUsesPerUser ? parseInt(data.maxUsesPerUser, 10) : null;
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);

    const promo = await prisma.promoCode.updateMany({
      where: { id: parseInt(id, 10), tenantId: req.user.tenantId },
      data
    });

    res.json({ success: true, data: promo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update promo' });
  }
});

// DELETE /api/promos/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.promoCode.deleteMany({
      where: { id: parseInt(req.params.id), tenantId: req.user.tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete promo' });
  }
});

module.exports = router;
