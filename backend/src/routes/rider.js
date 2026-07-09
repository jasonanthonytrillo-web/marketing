const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { sendPushToOrder } = require('./push');

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

// GET /api/rider/history — Get orders completed by this rider
router.get('/history', authenticate, authorize('rider', 'admin'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId,
        orderType: 'delivery',
        status: 'completed',
        riderId: req.user.id
      },
      include: { items: true },
      orderBy: { updatedAt: 'desc' } // show recently completed first
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load delivery history.' });
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

// POST /api/rider/orders/:id/notify-arrival — Alert customer
router.post('/orders/:id/notify-arrival', authenticate, authorize('rider', 'admin'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId: req.tenantId, riderId: req.user.id }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or not assigned to you.' });
    }

    // Emit socket event
    const io = req.io;
    if (io && io.emitRiderArrival) {
      io.emitRiderArrival(order);
    }

    // Send native push notification
    await sendPushToOrder(orderId, {
      title: 'Your order has arrived',
      body: `Your delivery rider has arrived with order #${order.orderNumber}!`,
      url: `/track/${order.orderNumber}`
    });

    // Log the arrival notification
    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'rider_arrival_notify',
        entityType: 'order',
        entityId: orderId.toString(),
        details: `Rider ${req.user.name} notified customer of arrival for Order #${order.orderNumber}`
      }
    });
    
    res.json({ success: true, message: 'Customer notified of arrival.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to notify arrival.' });
  }
});

module.exports = router;
