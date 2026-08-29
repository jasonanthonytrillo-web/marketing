const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// GET /api/cashier/orders — Get orders for cashier (pending + confirmed + preparing)
router.get('/orders', authenticate, authorize('cashier', 'admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const where = { tenantId: req.tenantId };
    
    if (status && status !== 'all') {
      where.status = status;
    } else {
      where.status = { in: ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'completed'] };
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load orders.' });
  }
});

// POST /api/cashier/orders/:id/confirm — Confirm order + process payment
router.post('/orders/:id/confirm', authenticate, authorize('cashier', 'admin'), async (req, res) => {
  let currentStep = 'initializing';
  try {
    const orderId = parseInt(req.params.id);
    const { amountReceived, paymentMethod, discountType, discountPercent, referenceNumber } = req.body;
    
    currentStep = 'fetching order';
    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId: req.tenantId },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Order is already processed.' });
    }

    currentStep = 'calculating totals';
    const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    const existingDiscountAmount = parseFloat(order.discountAmount) || 0;
    const effectiveDiscountType = (discountType && discountType !== '') ? discountType : (existingDiscountAmount > 0 ? (order.discountType || 'promo') : null);
    let discountAmount = 0;

    if (effectiveDiscountType === 'senior' || effectiveDiscountType === 'pwd') {
      discountAmount = order.subtotal * 0.20;
    } else if (effectiveDiscountType === 'promo') {
      if (discountPercent) {
        discountAmount = order.subtotal * (parseFloat(discountPercent) / 100);
      } else if (existingDiscountAmount > 0) {
        discountAmount = existingDiscountAmount;
      }
    } else if (existingDiscountAmount > 0 && !discountType) {
      discountAmount = existingDiscountAmount;
    }

    const taxRate = parseFloat(process.env.TAX_RATE || '0.00');
    let total = (order.subtotal + (order.deliveryFee || 0)) - discountAmount;
    const taxAmount = taxRate > 0 ? ((order.subtotal - discountAmount) - ((order.subtotal - discountAmount) / (1 + taxRate))) : 0;
    const taxableAmount = total - taxAmount;

    // Round monetary values
    discountAmount = round2(discountAmount || 0);
    const roundedTax = round2(taxAmount || 0);
    total = round2(total || 0);
    const method = paymentMethod || order.paymentMethod;
    const isPointsRedemption = method === 'points';
    const received = isPointsRedemption ? 0 : (parseFloat(amountReceived) || total);
    const change = isPointsRedemption ? 0 : (received - total);

    if (!isPointsRedemption && received < total) {
      return res.status(400).json({
        success: false,
        message: `Insufficient payment. Total: ₱${total.toFixed(2)}, Received: ₱${received.toFixed(2)}`
      });
    }

    // Calculate loyalty points (skip for points redemption — you don't earn points on free items)
    if (order.customerId && !isPointsRedemption) {
      currentStep = 'processing loyalty';
      let rate = 100; // default: 1 point per ₱100
      try {
        const tenantId = order.tenantId || 1;
        const rateSetting = await prisma.systemSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'points_rate' } } });
        if (rateSetting) rate = parseFloat(rateSetting.value);
      } catch (e) {
        // SystemSetting table may not exist yet, use default rate
        console.log('SystemSetting table not available, using default points rate:', rate);
      }
      const earnedPoints = Math.floor(total / rate);
      
      if (earnedPoints > 0) {
        await prisma.user.update({
          where: { id: order.customerId },
          data: { points: { increment: earnedPoints } }
        });
        
        if (req.io && req.io.emitLoyaltyUpdate) {
          req.io.emitLoyaltyUpdate(order.customerId, earnedPoints, order.tenantId);
        }
      }
    }

    // For points redemption orders, still emit a loyalty update so the customer's UI refreshes
    if (isPointsRedemption && order.customerId) {
      if (req.io && req.io.emitLoyaltyUpdate) {
        req.io.emitLoyaltyUpdate(order.customerId, 0, order.tenantId);
      }
    }

    const updated = await prisma.order.update({
      where: { id: orderId, tenantId: req.tenantId },
      data: {
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: method,
        discountType: effectiveDiscountType || null,
        discountAmount,
        taxAmount: roundedTax,
        total,
        cashierId: req.user.id,
        confirmedAt: new Date(),
        paymentReference: referenceNumber || order.paymentReference
      },
      include: { items: true }
    });

    currentStep = 'creating payment record';
    await prisma.payment.create({
      data: {
        orderId,
        amountDue: total,
        amountReceived: received,
        changeAmount: change,
        paymentMethod: method,
        discountType: effectiveDiscountType || null,
        discountAmount,
        taxAmount: roundedTax,
        cashierId: req.user.id
      }
    });

    currentStep = 'creating notification';
    await prisma.notification.create({
      data: {
        orderId,
        type: 'payment_confirmed',
        message: `Order #${order.orderNumber} confirmed.`,
        module: 'kitchen'
      }
    });

    currentStep = 'creating audit log';
    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'confirm_order',
        entityType: 'order',
        entityId: orderId.toString(),
        details: `Confirmed Order #${order.orderNumber}`
      }
    });

    currentStep = 'emitting websockets';
    const io = req.io;
    if (io) {
      io.emitKitchenOrder && io.emitKitchenOrder(updated);
      io.emitOrderUpdate && io.emitOrderUpdate(updated, 'confirmed');
    }

    res.json({
      success: true,
      data: { order: updated }
    });
  } catch (error) {
    console.error(`Confirm error at step [${currentStep}]:`, error);
    res.status(500).json({ 
      success: false, 
      message: `Failed at ${currentStep}`,
      error: error.message
    });
  }
});

// POST /api/cashier/orders/:id/cancel — Cashier cancel order
router.post('/orders/:id/cancel', authenticate, authorize('cashier', 'admin'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId: req.tenantId },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed or already cancelled order.' });
    }

    // Restore stock + create reversal logs
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } }
      });

      await prisma.inventoryLog.create({
        data: {
          productId: item.productId,
          quantityChange: item.quantity,
          reason: 'cancel',
          referenceId: `CANCEL-${order.orderNumber}`
        }
      });

      // Restore recipe ingredients
      try {
        const recipes = await prisma.recipeItem.findMany({ where: { productId: item.productId }, include: { rawIngredient: true } });
        for (const recipe of recipes) {
          const addAmount = (recipe.quantityUsed / Math.max(recipe.rawIngredient?.yield || 1, 0.001)) * item.quantity;
          await prisma.rawIngredient.update({
            where: { id: recipe.rawIngredientId },
            data: { stock: { increment: addAmount } }
          });
          await prisma.rawIngredientLog.create({
            data: {
              rawIngredientId: recipe.rawIngredientId,
              quantityChange: addAmount,
              reason: 'cancel',
              referenceId: `CANCEL-${order.orderNumber}`
            }
          });
        }
      } catch (err) {
        console.error('Recipe reversal error:', err);
      }

      // Restore addon ingredients
      if (item.addons) {
        try {
          const selectedAddons = typeof item.addons === 'string' ? JSON.parse(item.addons) : item.addons;
          for (const addon of selectedAddons) {
            if (addon.rawIngredientId && addon.quantityUsed) {
              const addAmount = addon.quantityUsed * item.quantity;
              await prisma.rawIngredient.update({
                where: { id: addon.rawIngredientId },
                data: { stock: { increment: addAmount } }
              });
              await prisma.rawIngredientLog.create({
                data: {
                  rawIngredientId: addon.rawIngredientId,
                  quantityChange: addAmount,
                  reason: 'cancel',
                  referenceId: `CANCEL-${order.orderNumber}`
                }
              });
            }
          }
        } catch (err) {
          console.error('Addon reversal error:', err);
        }
      }

      // Restore combo sub-items
      if (item.comboChoices) {
        try {
          const choices = typeof item.comboChoices === 'string' ? JSON.parse(item.comboChoices) : item.comboChoices;
          for (const key in choices) {
            const subProduct = choices[key];
            if (subProduct && subProduct.id) {
              await prisma.product.update({
                where: { id: parseInt(subProduct.id) },
                data: { stock: { increment: item.quantity } }
              });
              await prisma.inventoryLog.create({
                data: {
                  productId: parseInt(subProduct.id),
                  quantityChange: item.quantity,
                  reason: 'cancel',
                  referenceId: `CANCEL-${order.orderNumber}`
                }
              });
            }
          }
        } catch (err) {
          console.error('Combo reversal error:', err);
        }
      }
    }

    // Points Reversal Logic
    if (order.customerId) {
      let pointsToReturn = 0;
      let pointsToDeduct = 0;

      // 1. Calculate points to return (from redemptions)
      for (const item of order.items) {
        // Fallback: If the entire order is 'points' payment, treat items as redemptions
        const isActuallyRedemption = item.isRedemption || order.paymentMethod === 'points';
        
        if (isActuallyRedemption) {
          const product = await prisma.product.findUnique({ where: { id: item.productId } });
          if (product && product.pointsCost) {
            pointsToReturn += (product.pointsCost * item.quantity);
          }
        }
      }

      // 2. Calculate points to deduct (earned points if order was already confirmed/paid)
      // Points are only earned when order status moves from pending to confirmed
      if (order.status !== 'pending' && order.paymentMethod !== 'points') {
        let rate = 100;
        try {
          const tid = order.tenantId || 1;
          const rateSetting = await prisma.systemSetting.findUnique({ where: { tenantId_key: { tenantId: tid, key: 'points_rate' } } });
          if (rateSetting) rate = parseFloat(rateSetting.value);
        } catch (e) { /* use default */ }
        pointsToDeduct = Math.floor(order.total / rate);
      }

      const pointAdjustment = pointsToReturn - pointsToDeduct;
      
      if (pointAdjustment !== 0) {
        await prisma.user.update({
          where: { id: order.customerId },
          data: { points: { increment: pointAdjustment } }
        });

        // Emit loyalty update to customer
        if (req.io && req.io.emitLoyaltyUpdate) {
          req.io.emitLoyaltyUpdate(order.customerId, pointAdjustment, order.tenantId);
        }
      }
    }

    const updated = await prisma.order.update({
      where: { id: orderId, tenantId: req.tenantId },
      data: {
        status: 'cancelled',
        paymentStatus: order.paymentStatus === 'paid' ? 'refunded' : 'unpaid',
        cancellationReason: reason || 'Cancelled by cashier'
      },
      include: { items: true }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'cancel_order',
        entityType: 'order',
        entityId: orderId.toString(),
        details: reason || 'Cancelled by cashier'
      }
    });

    const io = req.io;
    if (io && io.emitOrderUpdate) {
      io.emitOrderUpdate(updated, 'cancelled');
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order.' });
  }
});

// POST /api/cashier/calculate — Calculate payment totals
router.post('/calculate', async (req, res) => {
  try {
    const { subtotal, deliveryFee, discountType, discountPercent, amountReceived } = req.body;
    
    const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    const subtotalValue = parseFloat(subtotal) || 0;
    const deliveryFeeValue = parseFloat(deliveryFee) || 0;
    let discountAmount = 0;
    const effectiveDiscountType = (discountType && discountType !== '') ? discountType : null;
    if (effectiveDiscountType === 'senior' || effectiveDiscountType === 'pwd') {
      discountAmount = subtotalValue * 0.20;
    } else if (effectiveDiscountType === 'promo' && discountPercent) {
      discountAmount = subtotalValue * (discountPercent / 100);
    }

    const taxRate = parseFloat(process.env.TAX_RATE || '0.00');
    discountAmount = round2(discountAmount);
    const total = round2(subtotalValue + deliveryFeeValue - discountAmount);
    const taxAmount = taxRate > 0 ? round2((subtotalValue - discountAmount) - ((subtotalValue - discountAmount) / (1 + taxRate))) : 0;
    const taxableAmount = round2(total - taxAmount);
    const receivedValue = parseFloat(amountReceived) || 0;
    const change = round2(receivedValue - total);

    res.json({
      success: true,
      data: {
        subtotal: round2(subtotalValue),
        discountType,
        discountAmount,
        taxableAmount,
        taxRate: round2(taxRate * 100),
        taxAmount,
        total,
        amountReceived: round2(receivedValue),
        change: Math.max(0, change),
        isInsufficient: amountReceived ? receivedValue < total : false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Calculation failed.' });
  }
});

// POST /api/cashier/orders/:id/request-payment — Trigger payment popup on kiosk
router.post('/orders/:id/request-payment', authenticate, authorize('cashier', 'admin'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { method } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId: req.tenantId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId }
    });

    // Fetch maya_qr from system settings
    let mayaQr = null;
    try {
      const mayaQrSetting = await prisma.systemSetting.findUnique({
        where: { tenantId_key: { tenantId: req.tenantId, key: 'maya_qr' } }
      });
      if (mayaQrSetting) mayaQr = mayaQrSetting.value;
    } catch (e) {
      console.error('Error fetching Maya QR setting:', e);
    }

    if (req.io && req.io.emitPaymentRequest) {
      req.io.emitPaymentRequest(order, tenant, mayaQr, method);
    }

    res.json({ success: true, message: 'Payment request sent to kiosk.' });
  } catch (error) {
    console.error('Request Payment Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send payment request.' });
  }
});

// POST /api/cashier/orders/:id/dispatch — Set status to 'on_the_way'
router.post('/orders/:id/dispatch', authenticate, authorize('cashier', 'admin'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const updated = await prisma.order.update({
      where: { id: orderId, tenantId: req.tenantId },
      data: { status: 'on_the_way' },
      include: { items: true }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'order_dispatched',
        entityType: 'order',
        entityId: orderId.toString(),
        details: `Order #${updated.orderNumber} dispatched for delivery.`
      }
    });

    const io = req.io;
    if (io && io.emitOrderUpdate) io.emitOrderUpdate(updated, 'on_the_way');
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to dispatch order.' });
  }
});

// POST /api/cashier/orders/:id/status — Generic status update
router.post('/orders/:id/status', authenticate, authorize('cashier', 'admin'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    const updated = await prisma.order.update({
      where: { id: orderId, tenantId: req.tenantId },
      data: { status },
      include: { items: true }
    });

    const io = req.io;
    if (io && io.emitOrderUpdate) io.emitOrderUpdate(updated, status);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update order status.' });
  }
});

// --- CASHIER SHIFT & CASH REGISTER TRACKING ---

// Helper to compute sales during a time window
async function computeShiftSales(tenantId, startTime, endTime = new Date()) {
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      status: { in: ['confirmed', 'preparing', 'ready', 'on_the_way', 'completed'] },
      createdAt: { gte: startTime, lte: endTime }
    },
    include: { payments: true }
  });

  let cashSales = 0;
  let onlineSales = 0;
  let totalSales = 0;

  for (const order of orders) {
    const orderTotal = parseFloat(order.total) || 0;
    totalSales += orderTotal;

    // Check payment method
    const method = (order.paymentMethod || '').toLowerCase();
    if (method === 'cash') {
      cashSales += orderTotal;
    } else {
      onlineSales += orderTotal;
    }
  }

  return {
    orderCount: orders.length,
    cashSales: Math.round(cashSales * 100) / 100,
    onlineSales: Math.round(onlineSales * 100) / 100,
    totalSales: Math.round(totalSales * 100) / 100
  };
}

// GET /api/cashier/shift/current — Get current active shift for logged-in staff
router.get('/shift/current', authenticate, authorize('cashier', 'kitchen', 'rider', 'admin'), async (req, res) => {
  try {
    const activeShift = await prisma.cashierShift.findFirst({
      where: {
        tenantId: req.tenantId,
        userId: req.user.id,
        status: 'active'
      },
      orderBy: { startTime: 'desc' }
    });

    if (!activeShift) {
      return res.json({ success: true, data: null });
    }

    if (activeShift.role === 'cashier') {
      const liveStats = await computeShiftSales(req.tenantId, activeShift.startTime);
      const expectedCash = Math.round(((activeShift.startingCash || 0) + liveStats.cashSales) * 100) / 100;

      return res.json({
        success: true,
        data: {
          ...activeShift,
          liveStats: {
            ...liveStats,
            expectedCash
          }
        }
      });
    }

    res.json({
      success: true,
      data: activeShift
    });
  } catch (error) {
    console.error('Error fetching current shift:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch current shift.' });
  }
});

// POST /api/cashier/shift/time-in — Start shift
router.post('/shift/time-in', authenticate, authorize('cashier', 'kitchen', 'rider', 'admin'), async (req, res) => {
  try {
    const { startingCash } = req.body;

    // Check if there is already an active shift
    const existing = await prisma.cashierShift.findFirst({
      where: {
        tenantId: req.tenantId,
        userId: req.user.id,
        status: 'active'
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active shift.',
        data: existing
      });
    }

    const role = req.user.role || 'staff';
    const initialAmount = role === 'cashier' ? Math.max(0, parseFloat(startingCash) || 0) : 0;

    const shift = await prisma.cashierShift.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        cashierName: req.user.name || 'Staff',
        role,
        startingCash: initialAmount,
        status: 'active',
        startTime: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'staff_time_in',
        entityType: 'staff_shift',
        entityId: shift.id.toString(),
        details: `${req.user.name} (${role}) timed in${role === 'cashier' ? ` with starting cash ₱${initialAmount.toFixed(2)}` : ''}.`
      }
    });

    res.json({
      success: true,
      data: shift,
      message: 'Time-in recorded successfully. Shift has started!'
    });
  } catch (error) {
    console.error('Error starting shift:', error);
    res.status(500).json({ success: false, message: 'Failed to record time-in.' });
  }
});

// POST /api/cashier/shift/time-out — End shift
router.post('/shift/time-out', authenticate, authorize('cashier', 'kitchen', 'rider', 'admin'), async (req, res) => {
  try {
    const { endingCash, notes } = req.body;

    const activeShift = await prisma.cashierShift.findFirst({
      where: {
        tenantId: req.tenantId,
        userId: req.user.id,
        status: 'active'
      },
      orderBy: { startTime: 'desc' }
    });

    if (!activeShift) {
      return res.status(400).json({ success: false, message: 'No active shift found to close.' });
    }

    const endTime = new Date();
    const isCashier = activeShift.role === 'cashier';

    let shiftData = {
      endTime,
      notes: notes ? notes.trim() : null,
      status: 'closed'
    };

    if (isCashier) {
      const stats = await computeShiftSales(req.tenantId, activeShift.startTime, endTime);
      const endingCashVal = Math.max(0, parseFloat(endingCash) || 0);
      const expectedCash = Math.round(((activeShift.startingCash || 0) + stats.cashSales) * 100) / 100;
      const cashDifference = Math.round((endingCashVal - expectedCash) * 100) / 100;

      shiftData = {
        ...shiftData,
        endingCash: endingCashVal,
        expectedCash,
        cashSales: stats.cashSales,
        onlineSales: stats.onlineSales,
        totalSales: stats.totalSales,
        orderCount: stats.orderCount,
        cashDifference
      };
    }

    const closedShift = await prisma.cashierShift.update({
      where: { id: activeShift.id },
      data: shiftData
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'staff_time_out',
        entityType: 'staff_shift',
        entityId: closedShift.id.toString(),
        details: `${req.user.name} (${activeShift.role}) timed out.${isCashier ? ` Ending Cash: ₱${closedShift.endingCash?.toFixed(2)}, Diff: ₱${closedShift.cashDifference?.toFixed(2)}.` : ''}`
      }
    });

    res.json({
      success: true,
      data: closedShift,
      message: 'Time-out recorded successfully. Shift closed!'
    });
  } catch (error) {
    console.error('Error ending shift:', error);
    res.status(500).json({ success: false, message: 'Failed to record time-out.' });
  }
});

// GET /api/cashier/shift/history — Recent shifts for this staff
router.get('/shift/history', authenticate, authorize('cashier', 'kitchen', 'rider', 'admin'), async (req, res) => {
  try {
    const shifts = await prisma.cashierShift.findMany({
      where: {
        tenantId: req.tenantId,
        userId: req.user.id
      },
      orderBy: { startTime: 'desc' },
      take: 20
    });

    res.json({ success: true, data: shifts });
  } catch (error) {
    console.error('Error fetching shift history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shift history.' });
  }
});

module.exports = router;


