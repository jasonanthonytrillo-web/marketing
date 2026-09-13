const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// GET /api/customer/activity — Get personalized timeline for the customer
router.get('/activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const where = { customerId: userId };

    // 1. Get Orders (Activity)
    const [orders, totalOrders, favoriteRows] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.order.count({ where }),
      prisma.orderItem.groupBy({
        by: ['productName'],
        where: { order: where },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 3
      })
    ]);

    // 2. Format Activity Feed
    const feed = [
      {
        type: 'milestone',
        date: req.user.createdAt,
        title: '🎉 Joined the Community',
        description: 'You created your account and started your journey with us!'
      },
      ...orders.map(o => ({
        type: 'order',
        id: o.id,
        orderNumber: o.orderNumber,
        date: o.createdAt,
        title: `Order #${o.orderNumber}`,
        description: o.items.map(i => i.productName).join(', '),
        total: o.total,
        status: o.status,
        items: o.items,
        hasRedemption: o.items.some(i => i.isRedemption)
      }))
    ];

    // Sort by date newest first
    const sortedFeed = feed.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. Calculate "Favorite" items
    const favorites = favoriteRows.map(row => ({ name: row.productName, count: row._sum.quantity || 0 }));

    res.json({
      success: true,
      data: {
        timeline: sortedFeed,
        favorites,
        stats: {
          totalOrders,
          totalPoints: req.user.points || 0,
          memberSince: req.user.createdAt
        },
        pagination: { page, limit, total: totalOrders, totalPages: Math.ceil(totalOrders / limit) }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to load activity.' });
  }
});

module.exports = router;
