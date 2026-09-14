const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const ExcelJS = require('exceljs');

const EXCEL_GREEN = '075B12';
const EXCEL_LIGHT_GREEN = 'E8F5E9';

function styleExcelSheet(sheet, title, subtitle, columns) {
  sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_GREEN } };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(2, 1, 2, columns.length);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: 'Aptos', size: 10, italic: true, color: { argb: '64748B' } };
  sheet.getRow(2).height = 22;

  sheet.addRow([]);
  const headerRow = sheet.addRow(columns.map(column => column.header));
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Aptos', bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_GREEN } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'B7D8BD' } } };
  });

  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width || 18;
  });
  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  return headerRow.number;
}

function styleExcelDataRows(sheet, firstDataRow, lastDataRow, columns) {
  for (let rowNumber = firstDataRow; rowNumber <= lastDataRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.eachCell((cell, columnNumber) => {
      cell.font = { name: 'Aptos', size: 10, color: { argb: '1E293B' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
      const column = columns[columnNumber - 1];
      if (column?.format) cell.numFmt = column.format;
    });
    row.height = 22;
  }
}

async function sendExcelWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.attachment(filename);
  await workbook.xlsx.write(res);
  res.end();
}

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

// GET /api/reports/category-profitability — Sales and expenses grouped by product category
router.get('/category-profitability', authenticate, authorize('admin'), async (req, res) => {
  try {
    const days = Math.max(1, parseInt(req.query.days, 10) || 30);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [categories, salesItems, expenses] = await Promise.all([
      prisma.category.findMany({
        where: { tenantId: req.tenantId, active: true },
        select: { id: true, name: true, icon: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.orderItem.findMany({
        where: {
          order: { tenantId: req.tenantId, status: 'completed', createdAt: { gte: startDate } }
        },
        select: {
          subtotal: true,
          quantity: true,
          product: { select: { categoryId: true } }
        }
      }),
      prisma.expense.findMany({
        where: { tenantId: req.tenantId, date: { gte: startDate }, categoryId: { not: null } },
        select: { amount: true, categoryId: true }
      })
    ]);

    const grouped = {};
    categories.forEach(category => {
      grouped[category.id] = {
        categoryId: category.id,
        name: category.name,
        icon: category.icon,
        unitsSold: 0,
        sales: 0,
        expenses: 0,
        profit: 0
      };
    });

    salesItems.forEach(item => {
      const categoryId = item.product?.categoryId;
      if (!grouped[categoryId]) return;
      grouped[categoryId].unitsSold += item.quantity;
      grouped[categoryId].sales += item.subtotal;
    });

    expenses.forEach(expense => {
      if (grouped[expense.categoryId]) grouped[expense.categoryId].expenses += expense.amount;
    });

    const data = Object.values(grouped).map(row => ({
      ...row,
      profit: row.sales - row.expenses
    }));

    res.json({ success: true, data: { days, categories: data } });
  } catch (error) {
    console.error('Category profitability error:', error);
    res.status(500).json({ success: false, message: 'Failed to load category profitability.' });
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

    const [todayAgg, weekAgg, monthAgg, todayExp, weekExp, monthExp, totalProducts, lowStock, totalVisitsSetting, inventoryLogs, rawLogs] = await Promise.all([
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
      prisma.product.count({ where: { stock: { lt: 10 }, available: true, tenantId: req.tenantId } }),
      prisma.systemSetting.findFirst({ where: { tenantId: req.tenantId, key: 'total_visits' } }),
      prisma.inventoryLog.findMany({
        where: { product: { tenantId: req.tenantId }, reason: { in: ['order', 'waste'] }, createdAt: { gte: monthAgo } },
        include: { product: { select: { costPrice: true } } }
      }),
      prisma.rawIngredientLog.findMany({
        where: { rawIngredient: { tenantId: req.tenantId }, reason: { in: ['order', 'waste'] }, createdAt: { gte: monthAgo } },
        include: { rawIngredient: { select: { costPrice: true } } }
      })
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

    const categoryStart = new Date();
    categoryStart.setDate(categoryStart.getDate() - 30);
    categoryStart.setHours(0, 0, 0, 0);
    const [categoryRows, categorySales, categoryExpenses] = await Promise.all([
      prisma.category.findMany({ where: { active: true, tenantId: req.tenantId }, select: { id: true, name: true } }),
      prisma.orderItem.findMany({
        where: { order: { tenantId: req.tenantId, status: 'completed', createdAt: { gte: categoryStart } } },
        select: { subtotal: true, product: { select: { categoryId: true } } }
      }),
      prisma.expense.findMany({
        where: { tenantId: req.tenantId, date: { gte: categoryStart }, categoryId: { not: null } },
        select: { amount: true, categoryId: true }
      })
    ]);
    const categoryTotals = categoryRows.reduce((result, category) => {
      result[category.id] = { id: category.id, name: category.name, sales: 0, expenses: 0, profit: 0 };
      return result;
    }, {});
    categorySales.forEach(item => {
      if (categoryTotals[item.product?.categoryId]) categoryTotals[item.product.categoryId].sales += item.subtotal;
    });
    categoryExpenses.forEach(expense => {
      if (categoryTotals[expense.categoryId]) categoryTotals[expense.categoryId].expenses += expense.amount;
    });
    const topCategories = Object.values(categoryTotals)
      .map(category => ({ ...category, profit: category.sales - category.expenses }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    const totalVisits = parseInt(totalVisitsSetting?.value || '0');

    // Live visitors from Socket.IO
    const io = req.app.get('io');
    const liveVisitors = io?.sockets?.adapter?.rooms?.get(`tenant-${req.tenantId}-visitors`)?.size || 0;

    // --- COGS Calculation ---
    let todayCogs = 0, weekCogs = 0, monthCogs = 0;
    
    const processCogsLog = (log, costPriceGetter) => {
      const cost = Math.abs(log.quantityChange) * (costPriceGetter(log) || 0);
      if (log.createdAt >= today) todayCogs += cost;
      if (log.createdAt >= weekAgo) weekCogs += cost;
      if (log.createdAt >= monthAgo) monthCogs += cost;
    };

    inventoryLogs?.forEach(log => processCogsLog(log, l => l.product?.costPrice));
    rawLogs?.forEach(log => processCogsLog(log, l => l.rawIngredient?.costPrice));

    res.json({
      success: true,
      data: { 
        today: { 
          sales: todayAgg._sum.total || 0, 
          orders: todayAgg._count.id || 0,
          expenses: todayExp._sum.amount || 0,
          profit: (todayAgg._sum.total || 0) - (todayExp._sum.amount || 0) - todayCogs
        }, 
        week: { 
          sales: weekAgg._sum.total || 0, 
          orders: weekAgg._count.id || 0,
          expenses: weekExp._sum.amount || 0,
          profit: (weekAgg._sum.total || 0) - (weekExp._sum.amount || 0) - weekCogs
        }, 
        month: { 
          sales: monthAgg._sum.total || 0, 
          orders: monthAgg._count.id || 0,
          expenses: monthExp._sum.amount || 0,
          profit: (monthAgg._sum.total || 0) - (monthExp._sum.amount || 0) - monthCogs
        }, 
        totalProducts, 
        lowStock,
        dailySales,
        revenue: todayAgg._sum.total || 0,
        totalExpenses: (todayExp._sum.amount || 0) + todayCogs,
        ordersCount: todayAgg._count.id || 0,
        productsCount: totalProducts,
        avgTicket: todayAgg._count.id > 0 ? (todayAgg._sum.total || 0) / todayAgg._count.id : 0,
        topCategories,
        totalVisits,
        liveVisitors,
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
    const [products, rawIngredients] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId: req.tenantId },
        include: { category: true }
      }),
      prisma.rawIngredient.findMany({
        where: { tenantId: req.tenantId }
      })
    ]);

    let csv = '\ufeffProduct Stock\n';
    csv += 'Product,Category,Current Stock,Cost Price (₱),Selling Price (₱)\n';
    products.forEach(p => {
      csv += `${p.name},${p.category?.name || 'N/A'},${p.stock},${p.costPrice || 0},${p.price}\n`;
    });

    csv += '\nRaw Ingredients\n';
    csv += 'Ingredient,Unit,Stock,Servings Yield,Cost Per Unit (₱),Total Cost (₱)\n';
    rawIngredients.forEach(ing => {
      const totalCost = parseFloat((ing.stock * (ing.costPrice || 0)).toFixed(2));
      csv += `${ing.name},${ing.unit},${parseFloat(Number(ing.stock).toFixed(2))},${ing.yield || 1},${ing.costPrice || 0},${totalCost}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.attachment(`Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// GET /api/reports/export/inventory.xlsx — Formatted inventory workbook
router.get('/export/inventory.xlsx', authenticate, authorize('admin'), async (req, res) => {
  try {
    const exportType = req.query.type === 'ingredients' ? 'ingredients' : 'products';
    const [products, rawIngredients] = await Promise.all([
      exportType === 'products' ? prisma.product.findMany({ where: { tenantId: req.tenantId }, include: { category: true }, orderBy: { name: 'asc' } }) : [],
      exportType === 'ingredients' ? prisma.rawIngredient.findMany({ where: { tenantId: req.tenantId }, orderBy: { name: 'asc' } }) : []
    ]);
    const workbook = new ExcelJS.Workbook();
    const productColumns = [
      { header: 'Product', width: 28 }, { header: 'Category', width: 22 }, { header: 'Current Stock', width: 16 },
      { header: 'Cost Price', width: 16, format: '₱#,##0.00' }, { header: 'Selling Price', width: 16, format: '₱#,##0.00' }, { header: 'Status', width: 16 }
    ];
    if (exportType === 'products') {
      const productSheet = workbook.addWorksheet('Product Stock');
      const productHeader = styleExcelSheet(productSheet, 'Hometown Brew — Product Stock', `Generated ${new Date().toLocaleString('en-PH')}`, productColumns);
      products.forEach(product => productSheet.addRow([
        product.name, product.category?.name || 'N/A', product.stock, product.costPrice || 0, product.price || 0, product.stock < 10 ? 'Low Stock' : 'In Stock'
      ]));
      styleExcelDataRows(productSheet, productHeader + 1, productSheet.rowCount, productColumns);
    }

    const ingredientColumns = [
      { header: 'Ingredient', width: 28 }, { header: 'Unit', width: 16 }, { header: 'Stock', width: 14 },
      { header: 'Servings Yield', width: 16 }, { header: 'Cost Per Unit', width: 18, format: '₱#,##0.00' }, { header: 'Total Cost', width: 18, format: '₱#,##0.00' }
    ];
    if (exportType === 'ingredients') {
      const ingredientSheet = workbook.addWorksheet('Raw Ingredients');
      const ingredientHeader = styleExcelSheet(ingredientSheet, 'Hometown Brew — Raw Ingredients', `Generated ${new Date().toLocaleString('en-PH')}`, ingredientColumns);
      rawIngredients.forEach(ingredient => ingredientSheet.addRow([
        ingredient.name, ingredient.unit, ingredient.stock, ingredient.yield || 1, ingredient.costPrice || 0, (ingredient.stock || 0) * (ingredient.costPrice || 0)
      ]));
      styleExcelDataRows(ingredientSheet, ingredientHeader + 1, ingredientSheet.rowCount, ingredientColumns);
    }
    const filename = exportType === 'products' ? 'Product_Stock' : 'Raw_Ingredients';
    await sendExcelWorkbook(res, workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Inventory Excel export error:', error);
    res.status(500).json({ success: false, message: 'Excel export failed' });
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

// GET /api/reports/export/suppliers.xlsx — Formatted supplier workbook
router.get('/export/suppliers.xlsx', authenticate, authorize('admin'), async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({ where: { tenantId: req.tenantId }, orderBy: { name: 'asc' } });
    const workbook = new ExcelJS.Workbook();
    const columns = [
      { header: 'Supplier Name', width: 28 }, { header: 'Contact Person', width: 24 }, { header: 'Email', width: 32 },
      { header: 'Phone', width: 18 }, { header: 'Address', width: 42 }
    ];
    const sheet = workbook.addWorksheet('Suppliers');
    const headerRow = styleExcelSheet(sheet, 'Hometown Brew — Supplier Directory', `Generated ${new Date().toLocaleString('en-PH')}`, columns);
    suppliers.forEach(supplier => sheet.addRow([supplier.name, supplier.contactPerson || '', supplier.email || '', supplier.phone || '', supplier.address || '']));
    styleExcelDataRows(sheet, headerRow + 1, sheet.rowCount, columns);
    await sendExcelWorkbook(res, workbook, `Suppliers_List_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Supplier Excel export error:', error);
    res.status(500).json({ success: false, message: 'Excel export failed' });
  }
});

// GET /api/reports/export/shifts.xlsx — Formatted staff shifts and drawer workbook
router.get('/export/shifts.xlsx', authenticate, authorize('admin'), async (req, res) => {
  try {
    const shifts = await prisma.cashierShift.findMany({
      where: { tenantId: req.tenantId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { startTime: 'desc' }
    });
    const workbook = new ExcelJS.Workbook();
    const columns = [
      { header: 'Staff Name', width: 24 }, { header: 'Email', width: 30 }, { header: 'Role', width: 14 }, { header: 'Status', width: 14 },
      { header: 'Time In', width: 22 }, { header: 'Time Out', width: 22 }, { header: 'Opening Float', width: 16, format: '₱#,##0.00' },
      { header: 'Cash Sales', width: 16, format: '₱#,##0.00' }, { header: 'Online Sales', width: 16, format: '₱#,##0.00' }, { header: 'Total Sales', width: 16, format: '₱#,##0.00' },
      { header: 'Orders', width: 12 }, { header: 'Expected Drawer', width: 18, format: '₱#,##0.00' }, { header: 'Counted Ending', width: 18, format: '₱#,##0.00' },
      { header: 'Variance', width: 16, format: '₱#,##0.00' }, { header: 'Notes', width: 34 }
    ];
    const sheet = workbook.addWorksheet('Shifts & Drawer');
    const headerRow = styleExcelSheet(sheet, 'Hometown Brew — Staff Shifts & Drawer', `Generated ${new Date().toLocaleString('en-PH')}`, columns);
    shifts.forEach(shift => sheet.addRow([
      shift.cashierName || shift.user?.name || 'Staff', shift.user?.email || '', shift.role, shift.status === 'active' ? 'Active' : 'Timed Out',
      shift.startTime ? new Date(shift.startTime).toLocaleString('en-PH') : '', shift.endTime ? new Date(shift.endTime).toLocaleString('en-PH') : 'In Progress',
      shift.startingCash || 0, shift.cashSales || 0, shift.onlineSales || 0, shift.totalSales || 0, shift.orderCount || 0,
      shift.expectedCash || 0, shift.endingCash ?? '', shift.cashDifference || 0, shift.notes || ''
    ]));
    styleExcelDataRows(sheet, headerRow + 1, sheet.rowCount, columns);
    await sendExcelWorkbook(res, workbook, `Staff_Shifts_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Shift Excel export error:', error);
    res.status(500).json({ success: false, message: 'Excel export failed' });
  }
});

// GET /api/reports/export/payroll.xlsx — Formatted payroll workbook
router.get('/export/payroll.xlsx', authenticate, authorize('admin'), async (req, res) => {
  try {
    const payments = await prisma.payrollPayment.findMany({
      where: { tenantId: req.tenantId },
      include: { staff: { select: { name: true, role: true } } },
      orderBy: [{ periodStart: 'desc' }, { staff: { name: 'asc' } }]
    });
    const workbook = new ExcelJS.Workbook();
    const columns = [
      { header: 'Staff Name', width: 26 }, { header: 'Role', width: 16 }, { header: 'Pay Period', width: 28 },
      { header: 'Gross Salary', width: 18, format: '₱#,##0.00' }, { header: 'Deduction', width: 16, format: '₱#,##0.00' },
      { header: 'Net Pay', width: 18, format: '₱#,##0.00' }, { header: 'Status', width: 16 }, { header: 'Payment Date', width: 22 }
    ];
    const sheet = workbook.addWorksheet('Payroll');
    const headerRow = styleExcelSheet(sheet, 'Hometown Brew — Payroll History', `Generated ${new Date().toLocaleString('en-PH')}`, columns);
    payments.forEach(payment => sheet.addRow([
      payment.staff?.name || 'Staff', payment.staff?.role || 'staff', `${new Date(payment.periodStart).toLocaleDateString('en-PH')} - ${new Date(payment.periodEnd).toLocaleDateString('en-PH')}`,
      payment.grossAmount ?? payment.amount, payment.deductionAmount || 0, payment.amount || 0, payment.status === 'paid' ? 'Paid' : 'Unpaid', payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-PH') : ''
    ]));
    styleExcelDataRows(sheet, headerRow + 1, sheet.rowCount, columns);
    await sendExcelWorkbook(res, workbook, `Payroll_History_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Payroll Excel export error:', error);
    res.status(500).json({ success: false, message: 'Excel export failed' });
  }
});

// GET /api/reports/export/bookings.xlsx — Formatted accepted bookings workbook
router.get('/export/bookings.xlsx', authenticate, authorize('admin'), async (req, res) => {
  try {
    const bookings = await prisma.eventBooking.findMany({
      where: { tenantId: req.tenantId, status: { in: ['accepted', 'confirmed'] } },
      include: { package: { select: { name: true } } },
      orderBy: { eventDate: 'asc' }
    });
    const workbook = new ExcelJS.Workbook();
    const columns = [
      { header: 'Booking ID', width: 14 }, { header: 'Customer', width: 24 }, { header: 'Email', width: 32 }, { header: 'Phone', width: 18 },
      { header: 'Package', width: 24 }, { header: 'Event Type', width: 20 }, { header: 'Event Date and Time', width: 24 }, { header: 'Venue', width: 30 },
      { header: 'Location Guide', width: 32 }, { header: 'Guests', width: 12 }, { header: 'Payment Method', width: 18 }, { header: 'Payment Mode', width: 24 },
      { header: 'Amount Paid', width: 18, format: '₱#,##0.00' }, { header: 'Booking Status', width: 18 }, { header: 'Approved At', width: 24 }
    ];
    const sheet = workbook.addWorksheet('Accepted Bookings');
    const headerRow = styleExcelSheet(sheet, 'Hometown Brew — Accepted Package Bookings', `Generated ${new Date().toLocaleString('en-PH')}`, columns);
    const paymentLabels = { cash: 'Cash', gcash: 'GCash', maya: 'Maya' };
    bookings.forEach(booking => sheet.addRow([
      booking.id, booking.customerName, booking.customerEmail, booking.customerPhone || '', booking.package?.name || '', booking.eventType,
      new Date(booking.eventDate).toLocaleString('en-PH'), booking.venue, booking.locationGuide || '', booking.guestCount || '', paymentLabels[booking.paymentMethod] || 'GCash',
      booking.paymentMode === 'downpayment' ? (booking.paymentStatus === 'paid' ? 'Downpayment + balance paid' : 'Downpayment (50%)') : 'Full payment',
      booking.paymentAmount || 0, booking.status, booking.reviewedAt ? new Date(booking.reviewedAt).toLocaleString('en-PH') : ''
    ]));
    styleExcelDataRows(sheet, headerRow + 1, sheet.rowCount, columns);
    await sendExcelWorkbook(res, workbook, `Accepted_Bookings_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Booking Excel export error:', error);
    res.status(500).json({ success: false, message: 'Excel export failed' });
  }
});

// GET /api/reports/export/sales.xlsx — Formatted Excel sales report
router.get('/export/sales.xlsx', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { date } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });
    }

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    const orders = await prisma.order.findMany({
      where: { tenantId: req.tenantId, status: 'completed', createdAt: { gte: start, lte: end } },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hometown Brew POS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Sales Report');
    const columns = [
      { header: 'Order #', width: 18 },
      { header: 'Date', width: 22 },
      { header: 'Customer', width: 24 },
      { header: 'Total (₱)', width: 16, format: '₱#,##0.00' },
      { header: 'Items', width: 52 }
    ];
    const headerRow = styleExcelSheet(
      sheet,
      'Hometown Brew — Sales Report',
      `Generated ${new Date().toLocaleString('en-PH')} • Completed orders only`,
      columns
    );

    orders.forEach(order => {
      sheet.addRow([
        order.orderNumber,
        new Date(order.createdAt),
        order.customerName || 'Walk-in',
        Number(order.total || 0),
        order.items.map(item => `${item.productName} (x${item.quantity})`).join('; ')
      ]);
    });
    styleExcelDataRows(sheet, headerRow + 1, sheet.rowCount, columns);
    sheet.getColumn(2).numFmt = 'mmm d, yyyy h:mm AM/PM';
    sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: columns.length } };
    if (orders.length) {
      const totalRow = sheet.addRow(['', '', 'TOTAL SALES', { formula: `SUM(D${headerRow + 1}:D${headerRow + orders.length})` }, '']);
      totalRow.font = { name: 'Aptos', bold: true, color: { argb: EXCEL_GREEN } };
      totalRow.getCell(3).alignment = { horizontal: 'right' };
      totalRow.getCell(4).numFmt = '₱#,##0.00';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment(`Sales_Report_${date}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Excel export failed' });
  }
});

// GET /api/reports/export/inventory.xlsx — Formatted Excel inventory report
router.get('/export/inventory.xlsx', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [products, rawIngredients] = await Promise.all([
      prisma.product.findMany({ where: { tenantId: req.tenantId }, include: { category: true }, orderBy: { name: 'asc' } }),
      prisma.rawIngredient.findMany({ where: { tenantId: req.tenantId }, orderBy: { name: 'asc' } })
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hometown Brew POS';
    workbook.created = new Date();

    const productSheet = workbook.addWorksheet('Product Stock');
    const productColumns = [
      { header: 'Product', width: 30 },
      { header: 'Category', width: 22 },
      { header: 'Current Stock', width: 18, format: '#,##0' },
      { header: 'Cost Price (₱)', width: 18, format: '₱#,##0.00' },
      { header: 'Selling Price (₱)', width: 20, format: '₱#,##0.00' }
    ];
    const productHeader = styleExcelSheet(productSheet, 'Hometown Brew — Product Stock', `Generated ${new Date().toLocaleString('en-PH')}`, productColumns);
    products.forEach(product => productSheet.addRow([
      product.name,
      product.category?.name || 'N/A',
      Number(product.stock || 0),
      Number(product.costPrice || 0),
      Number(product.price || 0)
    ]));
    styleExcelDataRows(productSheet, productHeader + 1, productSheet.rowCount, productColumns);
    productSheet.autoFilter = { from: { row: productHeader, column: 1 }, to: { row: productHeader, column: productColumns.length } };

    const ingredientSheet = workbook.addWorksheet('Raw Ingredients');
    const ingredientColumns = [
      { header: 'Ingredient', width: 30 },
      { header: 'Unit', width: 15 },
      { header: 'Stock', width: 15, format: '#,##0.00' },
      { header: 'Servings Yield', width: 18, format: '#,##0.00' },
      { header: 'Cost Per Unit (₱)', width: 20, format: '₱#,##0.00' },
      { header: 'Total Cost (₱)', width: 18, format: '₱#,##0.00' }
    ];
    const ingredientHeader = styleExcelSheet(ingredientSheet, 'Hometown Brew — Raw Ingredients', `Generated ${new Date().toLocaleString('en-PH')}`, ingredientColumns);
    rawIngredients.forEach(ingredient => {
      const stock = Number(ingredient.stock || 0);
      const cost = Number(ingredient.costPrice || 0);
      ingredientSheet.addRow([ingredient.name, ingredient.unit, stock, Number(ingredient.yield || 1), cost, stock * cost]);
    });
    styleExcelDataRows(ingredientSheet, ingredientHeader + 1, ingredientSheet.rowCount, ingredientColumns);
    ingredientSheet.autoFilter = { from: { row: ingredientHeader, column: 1 }, to: { row: ingredientHeader, column: ingredientColumns.length } };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment(`Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Excel export failed' });
  }
});

// GET /api/reports/sales-by-date?date=YYYY-MM-DD
router.get('/sales-by-date', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });

    // Use UTC day boundaries — this matches how the P&L table groups dates
    // (the P&L uses toISOString().split('T')[0] = UTC date key)
    const start = new Date(`${date}T00:00:00.000Z`);
    const end   = new Date(`${date}T23:59:59.999Z`);

    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          tenantId: req.tenantId,
          status: 'completed',
          createdAt: { gte: start, lte: end }
        }
      },
      select: {
        productName: true,
        quantity: true,
        subtotal: true,
        productPrice: true,
        product: { select: { costPrice: true } }
      }
    });

    console.log(`[sales-by-date] date=${date} start=${start.toISOString()} end=${end.toISOString()} items=${items.length} tenantId=${req.tenantId}`);

    const aggregated = {};
    items.forEach(i => {
      const costPrice = i.product?.costPrice || 0;
      const totalCost = costPrice * i.quantity;
      if (!aggregated[i.productName]) {
        aggregated[i.productName] = { name: i.productName, quantity: 0, revenue: 0, cost: 0, profit: 0, unitPrice: i.productPrice, costPrice };
      }
      aggregated[i.productName].quantity += i.quantity;
      aggregated[i.productName].revenue += i.subtotal;
      aggregated[i.productName].cost   += totalCost;
      aggregated[i.productName].profit += i.subtotal - totalCost;
    });

    const products = Object.values(aggregated).sort((a, b) => b.profit - a.profit);
    const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
    const totalProfit  = products.reduce((s, p) => s + p.profit, 0);
    const totalItems   = products.reduce((s, p) => s + p.quantity, 0);

    res.json({ success: true, data: { date, products, totalRevenue, totalProfit, totalItems } });
  } catch (error) {
    console.error('Sales-by-date error:', error);
    res.status(500).json({ success: false, message: 'Failed to load sales by date.' });
  }
});

module.exports = router;
