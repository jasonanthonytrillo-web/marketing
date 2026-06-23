const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// GET /api/rider/available — Get orders ready for dispatch
router.get('/available', authenticate, authorize('rider', 'admin'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId,
        orderType: 'delivery',
        status: 'ready',
        riderId: null
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load available orders.' });
  }
});

// GET /api/rider/active — Get orders assigned to this rider
router.get('/active', authenticate, authorize('rider', 'admin'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId,
        orderType: 'delivery',
        status: 'on_the_way',
        riderId: req.user.id
      },
      include: { items: true },
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load active deliveries.' });
  }
});

// POST /api/rider/orders/:id/pickup — Assign and dispatch
router.post('/orders/:id/pickup', authenticate, authorize('rider', 'admin'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    // Check if already taken
    const check = await prisma.order.findUnique({ where: { id: orderId } });
    if (check.riderId && check.riderId !== req.user.id) {
      return res.status(400).json({ success: false, message: 'Order already picked up by another rider.' });
    }

    const updated = await prisma.order.update({
      where: { id: orderId, tenantId: req.tenantId },
      data: {
        status: 'on_the_way',
        riderId: req.user.id
      },
      include: { items: true }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'rider_pickup',
        entityType: 'order',
        entityId: orderId.toString(),
        details: `Rider ${req.user.name} picked up Order #${updated.orderNumber}`
      }
    });

    const io = req.io;
    if (io && io.emitOrderUpdate) io.emitOrderUpdate(updated, 'on_the_way');
    
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to pick up order.' });
  }
});

// POST /api/rider/orders/:id/delivered — Mark as completed
router.post('/orders/:id/delivered', authenticate, authorize('rider', 'admin'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const updated = await prisma.order.update({
      where: { id: orderId, tenantId: req.tenantId, riderId: req.user.id },
      data: { status: 'completed' },
      include: { items: true }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'rider_delivered',
        entityType: 'order',
        entityId: orderId.toString(),
        details: `Rider ${req.user.name} delivered Order #${updated.orderNumber}`
      }
    });

    const io = req.io;
    if (io && io.emitOrderUpdate) io.emitOrderUpdate(updated, 'completed');
    
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark as delivered.' });
  }
});

module.exports = router;
