const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Generate unique order number like POS-240001
function generateOrderNumber() {
  const prefix = 'POS';
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}`;
}
// GET /api/orders/history — Get logged-in customer's order history
const { authenticate } = require('../middleware/auth');
router.get('/history', authenticate, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, message: 'Failed to load order history.' });
  }
});

// POST /api/orders — Kiosk: Place new order
router.post('/', async (req, res) => {
  try {
    const { customerId, customerName, orderType, paymentMethod, items, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must have at least one item.' });
    }

    // Generate unique order number
    let orderNumber;
    let exists = true;
    while (exists) {
      orderNumber = generateOrderNumber();
      const check = await prisma.order.findUnique({ where: { orderNumber } });
      exists = !!check;
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { addons: true }
      });

      if (!product) {
        return res.status(400).json({ success: false, message: `Product ID ${item.productId} not found.` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Only ${product.stock} left.`
        });
      }

      let itemSubtotal = product.price * item.quantity;
      
      // Zero out cash cost if it's a redemption
      if (item.isRedemption && product.pointsCost) {
        itemSubtotal = 0;
      }

      // Calculate addon prices
      let selectedAddons = [];
      if (item.addons && item.addons.length > 0 && !item.isRedemption) {
        for (const addonId of item.addons) {
          const addon = product.addons.find(a => a.id === addonId);
          if (addon) {
            selectedAddons.push({ name: addon.name, price: addon.price });
            itemSubtotal += addon.price * item.quantity;
          }
        }
      }

      subtotal += itemSubtotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        size: item.size || null,
        flavor: item.flavor || null,
        notes: item.notes || null,
        addons: selectedAddons.length > 0 ? JSON.stringify(selectedAddons) : null,
        isRedemption: item.isRedemption || false
      });
    }

    const taxRate = parseFloat(process.env.TAX_RATE || '0.12');
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    // Handle Loyalty Redemptions & Role Check
    let validCustomerId = null;
    if (customerId) {
      const customer = await prisma.user.findUnique({ where: { id: parseInt(customerId) } });
      if (customer && customer.role === 'customer') {
        validCustomerId = customer.id;
        let totalPointsRequired = 0;
        // Re-check items for redemption status
        for (const item of items) {
          if (item.isRedemption) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } });
            if (product && product.pointsCost) {
              totalPointsRequired += (product.pointsCost * item.quantity);
            }
          }
        }

        if (totalPointsRequired > customer.points) {
          return res.status(400).json({ success: false, message: `Insufficient points. You need ${totalPointsRequired} points.` });
        }

        if (totalPointsRequired > 0) {
          await prisma.user.update({
            where: { id: customer.id },
            data: { points: { decrement: totalPointsRequired } }
          });

          // Emit real-time loyalty update so customer UI refreshes instantly
          if (req.io && req.io.emitLoyaltyUpdate) {
            req.io.emitLoyaltyUpdate(customer.id, -totalPointsRequired);
          }
        }
      }
    }

    // Create order with items
    let tenantId = req.headers['x-tenant-id'] ? parseInt(req.headers['x-tenant-id']) : 1;
    const tenantSlug = req.headers['x-tenant-slug'];

    if (tenantSlug) {
      if (tenantSlug === 'project-million') {
        tenantId = 1;
      } else {
        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (tenant) tenantId = tenant.id;
      }
    }

    const order = await prisma.order.create({
      data: {
        tenantId,
        orderNumber,
        customerId: validCustomerId,
        customerName: customerName || (validCustomerId ? undefined : 'Guest'),
        orderType: orderType || 'dine_in',
        paymentMethod: paymentMethod || 'cash',
        status: 'pending',
        paymentStatus: 'unpaid',
        subtotal,
        taxAmount,
        total,
        notes: notes || null,
        items: { create: orderItems }
      },
      include: {
        items: true,
        customer: { select: { id: true, name: true, points: true } }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: validCustomerId,
        action: 'order_placed',
        entityType: 'order',
        entityId: order.id.toString(),
        details: `Order #${order.orderNumber} placed by ${order.customerName}. Total: ₱${total.toFixed(2)}`
      }
    });

    // Decrement stock
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      });

      await prisma.inventoryLog.create({
        data: {
          productId: item.productId,
          quantityChange: -item.quantity,
          reason: 'order',
          referenceId: order.orderNumber
        }
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        orderId: order.id,
        type: 'order_placed',
        message: `New order #${order.orderNumber} from ${order.customerName}`,
        module: 'cashier'
      }
    });

    // Emit to cashier via WebSocket
    const io = req.io;
    if (io && io.emitNewOrder) {
      io.emitNewOrder(order);
    }

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Failed to place order.' });
  }
});

// GET /api/orders/queue/active — Get active queue (preparing + ready)
router.get('/queue/active', async (req, res) => {
  try {
    const tenantSlug = req.headers['x-tenant-slug'];
    let whereClause = { status: { in: ['confirmed', 'preparing', 'ready'] } };

    if (tenantSlug && tenantSlug !== 'project-million') {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) {
        whereClause.tenantId = tenant.id;
      }
    } else {
      // Default to Project Million (ID: 1) if no slug or default slug
      whereClause.tenantId = 1;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        orderType: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
        kitchenStartedAt: true,
        kitchenCompletedAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    const preparing = orders.filter(o => ['confirmed', 'preparing'].includes(o.status));
    const ready = orders.filter(o => o.status === 'ready');

    res.json({
      success: true,
      data: { preparing, ready, totalActive: orders.length }
    });
  } catch (error) {
    console.error('Queue error:', error);
    res.status(500).json({ success: false, message: 'Failed to load queue.' });
  }
});

// GET /api/orders/:orderNumber — Get order by number (for kiosk tracking)
router.get('/:orderNumber', async (req, res) => {
  try {
    const tenantSlug = req.headers['x-tenant-slug'];
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: { items: true, payments: true, tenant: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // SECURITY: Ensure order belongs to the tenant slug from header
    if (tenantSlug && tenantSlug !== 'project-million' && order.tenant.slug !== tenantSlug) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this order.' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load order.' });
  }
});

// POST /api/orders/:orderNumber/cancel — Customer cancel (only if pending)
router.post('/:orderNumber/cancel', async (req, res) => {
  try {
    const tenantSlug = req.headers['x-tenant-slug'];
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: { items: true, tenant: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // SECURITY: Ensure order belongs to the tenant
    if (tenantSlug && tenantSlug !== 'project-million' && order.tenant.slug !== tenantSlug) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Order can only be cancelled while pending.' });
    }

    // Restore stock
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } }
      });

      await prisma.inventoryLog.create({
        data: {
          productId: item.productId,
          quantityChange: item.quantity,
          reason: 'order',
          referenceId: `CANCEL-${order.orderNumber}`
        }
      });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
      include: { items: true }
    });

    const io = req.io;
    if (io && io.emitOrderUpdate) {
      io.emitOrderUpdate(updated, 'cancelled');
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel order.' });
  }
});

module.exports = router;
