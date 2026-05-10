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
    startDate.setHours(0, 0, 0, 0);

    const [orders, expenses, wasteLogs] = await Promise.all([
      prisma.order.findMany({
        where: { 
          createdAt: { gte: startDate }, 
          status: 'completed',
          tenantId: req.tenantId
        },
        select: { total: true, createdAt: true }
      }),
      prisma.expense.findMany({
        where: {
          date: { gte: startDate },
          tenantId: req.tenantId
        },
        select: { amount: true, date: true }
      }),
      prisma.inventoryLog.findMany({
        where: {
          createdAt: { gte: startDate },
          reason: 'waste',
          product: { tenantId: req.tenantId }
        },
        include: { product: { select: { costPrice: true } } }
      })
    ]);

    const dailyMap = {};
    const getDateKey = (date) => new Date(date).toISOString().split('T')[0];
    
    // Process Orders
    orders.forEach(o => {
      const day = getDateKey(o.createdAt);
      if (!dailyMap[day]) dailyMap[day] = { date: day, sales: 0, expenses: 0, profit: 0, orders: 0, waste: 0 };
      dailyMap[day].sales += o.total;
      dailyMap[day].orders += 1;
    });

    // Process Expenses
    expenses.forEach(e => {
      const day = getDateKey(e.date);
      if (!dailyMap[day]) dailyMap[day] = { date: day, sales: 0, expenses: 0, profit: 0, orders: 0, waste: 0 };
      dailyMap[day].expenses += e.amount;
    });

    // Process Waste (as additional expense)
    wasteLogs.forEach(w => {
      const day = getDateKey(w.createdAt);
      if (!dailyMap[day]) dailyMap[day] = { date: day, sales: 0, expenses: 0, profit: 0, orders: 0, waste: 0 };
      const wasteCost = Math.abs(w.quantityChange) * (w.product.costPrice || 0);
      dailyMap[day].expenses += wasteCost;
      dailyMap[day].waste = (dailyMap[day].waste || 0) + wasteCost;
    });

    // Calculate Profit
    Object.keys(dailyMap).forEach(day => {
      dailyMap[day].profit = dailyMap[day].sales - dailyMap[day].expenses;
    });

    res.json({ success: true, data: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)) });
  } catch (error) {
    console.error('Daily report error:', error);
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
          tenantId: req.tenantId
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

    // Parallel aggregation for Today, Week, and Month
    // Fetch Tenant Branding
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { primaryColor: true, secondaryColor: true }
    });

    const [todayAgg, weekAgg, monthAgg, todayExp, weekExp, monthExp, totalProducts, lowStock] = await Promise.all([
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
      prisma.expense.aggregate({
        where: { tenantId: req.tenantId, date: { gte: today } },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: { tenantId: req.tenantId, date: { gte: weekAgo } },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: { tenantId: req.tenantId, date: { gte: monthAgo } },
        _sum: { amount: true }
      }),
      prisma.product.count({ where: { available: true, tenantId: req.tenantId } }),
      prisma.product.count({ where: { stock: { lt: 10 }, available: true, tenantId: req.tenantId } })
    ]);

    // Single query for the 14-day chart
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

    const dailySales = Object.keys(dailyMap)
      .sort() // Keys are YYYY-MM-DD, so simple sort works perfectly
      .map(dateKey => dailyMap[dateKey]);

    const topCategories = await prisma.category.findMany({
      where: { tenantId: req.tenantId },
      take: 5,
      include: { _count: { select: { products: true } } }
    });

    res.json({
      success: true,
      data: { 
        today: { 
          sales: todayAgg._sum.total || 0, 
          orders: todayAgg._count.id || 0,
          expenses: todayExp._sum.amount || 0,
          profit: (todayAgg._sum.total || 0) - (todayExp._sum.amount || 0)
        }, 
        week: { 
          sales: weekAgg._sum.total || 0, 
          orders: weekAgg._count.id || 0,
          expenses: weekExp._sum.amount || 0,
          profit: (weekAgg._sum.total || 0) - (weekExp._sum.amount || 0)
        }, 
        month: { 
          sales: monthAgg._sum.total || 0, 
          orders: monthAgg._count.id || 0,
          expenses: monthExp._sum.amount || 0,
          profit: (monthAgg._sum.total || 0) - (monthExp._sum.amount || 0)
        }, 
        totalProducts, 
        lowStock,
        dailySales,
        revenue: todayAgg._sum.total || 0,
        totalExpenses: todayExp._sum.amount || 0,
        ordersCount: todayAgg._count.id || 0,
        productsCount: totalProducts,
        avgTicket: todayAgg._count.id > 0 ? (todayAgg._sum.total || 0) / todayAgg._count.id : 0,
        topCategories,
        branding: {
          primaryColor: tenant?.primaryColor,
          secondaryColor: tenant?.secondaryColor
        }
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
        tenantId: req.tenantId
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

// GET /api/reports/forecasting
router.get('/forecasting', authenticate, authorize('admin'), async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId,
        status: 'completed',
        createdAt: { gte: thirtyDaysAgo }
      },
      select: { total: true, createdAt: true }
    });

    // 1. Group by Day of Week (0-6)
    const dayOfWeekStats = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const getDateKey = (date) => new Date(date).toISOString().split('T')[0];
    const dailyTotals = {};

    orders.forEach(o => {
      const dayKey = getDateKey(o.createdAt);
      if (!dailyTotals[dayKey]) dailyTotals[dayKey] = 0;
      dailyTotals[dayKey] += o.total;
    });

    Object.keys(dailyTotals).forEach(dateStr => {
      const d = new Date(dateStr);
      dayOfWeekStats[d.getDay()].push(dailyTotals[dateStr]);
    });

    // 2. Calculate Averages per Day of Week
    const averages = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < 7; i++) {
      const stats = dayOfWeekStats[i];
      const avg = stats.length > 0 ? stats.reduce((a, b) => a + b, 0) / stats.length : 0;
      averages[i] = { name: dayNames[i], average: avg };
    }

    // 3. Simple Trend Analysis (Compare first 15 days vs last 15 days)
    const sortedDates = Object.keys(dailyTotals).sort();
    const mid = Math.floor(sortedDates.length / 2);
    const firstHalf = sortedDates.slice(0, mid).reduce((sum, d) => sum + dailyTotals[d], 0);
    const secondHalf = sortedDates.slice(mid).reduce((sum, d) => sum + dailyTotals[d], 0);
    
    const growthTrend = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    // 4. Predict Tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDay();
    const basePrediction = averages[tomorrowDay].average;
    
    // Apply trend factor (conservative 20% weight to trend)
    const predictedRevenue = basePrediction * (1 + (growthTrend / 100) * 0.2);
    const confidenceScore = orders.length > 50 ? 'High' : (orders.length > 20 ? 'Medium' : 'Low');

    // --- 4. Inventory Awareness (Lost Opportunity Logic) ---
    const topProducts = await prisma.product.findMany({
      where: { tenantId: req.tenantId, available: true },
      orderBy: { orderItems: { _count: 'desc' } },
      take: 5,
      select: { id: true, name: true, stock: true, price: true }
    });

    const inventoryWarnings = [];
    topProducts.forEach(p => {
      const estimatedUnitsNeeded = Math.ceil(predictedRevenue / (p.price || 1) * 0.5); // Assume 50% of revenue from top items
      if (p.stock < estimatedUnitsNeeded) {
        inventoryWarnings.push({
          productId: p.id,
          productName: p.name,
          currentStock: p.stock,
          predictedNeeded: estimatedUnitsNeeded,
          lostRevenuePotential: (estimatedUnitsNeeded - p.stock) * p.price
        });
      }
    });

    res.json({
      success: true,
      data: {
        tomorrow: {
          day: dayNames[tomorrowDay],
          predictedRevenue: Math.max(0, Math.round(predictedRevenue)),
          confidence: confidenceScore
        },
        growthTrend: growthTrend.toFixed(1),
        dayOfWeekAverages: Object.values(averages),
        inventoryWarnings
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Forecasting failed.' });
  }
});

// GET /api/reports/export/sales — Export sales to CSV
router.get('/export/sales', authenticate, authorize('admin'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { tenantId: req.tenantId, status: 'completed' },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    let csv = '\ufeffOrder #,Date,Customer,Total (₱),Items\n';
    orders.forEach(o => {
      const items = o.items.map(i => `${i.productName} (x${i.quantity})`).join('; ');
      const date = new Date(o.createdAt).toLocaleString('en-PH');
      csv += `${o.orderNumber},"${date}",${o.customerName || 'Walk-in'},${o.total},"${items}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.attachment(`Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// GET /api/reports/export/inventory — Export inventory to CSV
router.get('/export/inventory', authenticate, authorize('admin'), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { tenantId: req.tenantId },
      include: { category: true }
    });

    let csv = '\ufeffProduct,Category,Current Stock,Cost Price (₱),Selling Price (₱)\n';
    products.forEach(p => {
      csv += `${p.name},${p.category?.name || 'N/A'},${p.stock},${p.costPrice || 0},${p.price}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.attachment(`Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// GET /api/reports/export/suppliers — Export suppliers to CSV
router.get('/export/suppliers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: req.tenantId }
    });

    let csv = '\ufeffSupplier Name,Contact Person,Email,Phone,Address\n';
    suppliers.forEach(s => {
      csv += `${s.name},${s.contactPerson || ''},${s.email || ''},${s.phone || ''},"${s.address || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.attachment(`Suppliers_List_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

module.exports = router;
