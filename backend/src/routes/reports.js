const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// GET /api/reports/daily
router.get('/daily', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const orders = await prisma.order.findMany({
      where: { 
        createdAt: { gte: startDate }, 
        status: 'completed',
        tenantId: req.user.tenantId
      },
      select: { total: true, createdAt: true, status: true }
    });
    const dailyMap = {};
    orders.forEach(o => {
      const day = o.createdAt.toISOString().split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, sales: 0, orders: 0 };
      dailyMap[day].sales += o.total;
      dailyMap[day].orders += 1;
    });
    res.json({ success: true, data: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load daily report.' });
  }
});

// GET /api/reports/bestsellers
router.get('/bestsellers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const items = await prisma.orderItem.findMany({
      where: { 
        order: { 
          status: 'completed',
          tenantId: req.user.tenantId
        } 
      },
      select: { productName: true, quantity: true, subtotal: true }
    });
    
    const aggregated = {};
    items.forEach(i => {
      if (!aggregated[i.productName]) {
        aggregated[i.productName] = { quantity: 0, revenue: 0 };
      }
      aggregated[i.productName].quantity += i.quantity;
      aggregated[i.productName].revenue += i.subtotal;
    });

    const sorted = Object.keys(aggregated)
      .map(name => ({ name, quantity: aggregated[name].quantity, revenue: aggregated[name].revenue }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    res.json({ success: true, data: sorted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load bestsellers.' });
  }
});

// GET /api/reports/summary
router.get('/summary', authenticate, authorize('admin'), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    const chartStart = new Date(); chartStart.setDate(chartStart.getDate() - 13);
    chartStart.setHours(0, 0, 0, 0);

    // Optimized aggregation for Today, Week, and Month in parallel
    const [todayAgg, weekAgg, monthAgg, totalProducts, lowStock] = await Promise.all([
      prisma.order.aggregate({
        where: { tenantId: req.tenantId, status: 'completed', createdAt: { gte: today } },
        _sum: { total: true }, _count: { id: true }
      }),
      prisma.order.aggregate({
        where: { tenantId: req.tenantId, status: 'completed', createdAt: { gte: weekAgo } },
        _sum: { total: true }, _count: { id: true }
      }),
      prisma.order.aggregate({
        where: { tenantId: req.tenantId, status: 'completed', createdAt: { gte: monthAgo } },
        _sum: { total: true }, _count: { id: true }
      }),
      prisma.product.count({ where: { available: true, tenantId: req.tenantId } }),
      prisma.product.count({ where: { stock: { lt: 10 }, available: true, tenantId: req.tenantId } })
    ]);

    // Single query for the 14-day chart using Raw Query for better date grouping performance
    // Or use findMany and aggregate in JS to avoid raw SQL for now
    const chartOrders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId,
        status: 'completed',
        createdAt: { gte: chartStart }
      },
      select: { total: true, createdAt: true }
    });

    const dailyMap = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      dailyMap[d.toISOString().split('T')[0]] = { label, revenue: 0 };
    }

    chartOrders.forEach(o => {
      const day = o.createdAt.toISOString().split('T')[0];
      if (dailyMap[day]) dailyMap[day].revenue += o.total;
    });

    const dailySales = Object.values(dailyMap).sort((a, b) => {
      return new Date(a.label + ' ' + new Date().getFullYear()) - new Date(b.label + ' ' + new Date().getFullYear());
    });

    const topCategories = await prisma.category.findMany({
      where: { tenantId: req.user.tenantId },
      take: 5,
      include: { _count: { select: { products: true } } }
    });

    res.json({
      success: true,
      data: { 
        today: { sales: todayAgg._sum.total || 0, orders: todayAgg._count.id || 0 }, 
        week: { sales: weekAgg._sum.total || 0, orders: weekAgg._count.id || 0 }, 
        month: { sales: monthAgg._sum.total || 0, orders: monthAgg._count.id || 0 }, 
        totalProducts, 
        lowStock,
        dailySales,
        revenue: todayAgg._sum.total || 0,
        ordersCount: todayAgg._count.id || 0,
        productsCount: totalProducts,
        avgTicket: todayAgg._count.id > 0 ? (todayAgg._sum.total || 0) / todayAgg._count.id : 0,
        topCategories
      }
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to load summary.' });
  }
});

// GET /api/reports/kitchen-times
router.get('/kitchen-times', authenticate, authorize('admin'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { 
        kitchenStartedAt: { not: null }, 
        kitchenCompletedAt: { not: null },
        tenantId: req.user.tenantId
      },
      select: { orderNumber: true, kitchenStartedAt: true, kitchenCompletedAt: true, confirmedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    const data = orders.map(o => {
      const diffMs = o.kitchenCompletedAt - o.kitchenStartedAt;
      let mins = Math.round(diffMs / 60000);
      if (mins === 0 && diffMs > 0) mins = 1; // At least 1 min if any time spent
      return {
        orderNumber: o.orderNumber,
        prepTimeMinutes: mins
      };
    });
    const avg = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.prepTimeMinutes, 0) / data.length) : 0;
    res.json({ success: true, data: { orders: data, averagePrepTime: avg } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load kitchen times.' });
  }
});

module.exports = router;
