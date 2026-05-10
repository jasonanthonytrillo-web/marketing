const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// GET /api/customer/activity — Get personalized timeline for the customer
router.get('/activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get Orders (Activity)
    const orders = await prisma.order.findMany({
      where: { customerId: userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

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
        date: o.createdAt,
        title: `🍔 Order #${o.orderNumber}`,
        description: o.items.map(i => i.productName).join(', '),
        total: o.total,
        status: o.status,
        items: o.items
      }))
    ];

    // Sort by date newest first
    const sortedFeed = feed.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. Calculate "Favorite" items
    const productCounts = {};
    orders.forEach(o => {
      o.items.forEach(i => {
        productCounts[i.productName] = (productCounts[i.productName] || 0) + i.quantity;
      });
    });
    
    const favorites = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    res.json({
      success: true,
      data: {
        timeline: sortedFeed,
        favorites,
        stats: {
          totalOrders: orders.length,
          totalPoints: req.user.points || 0,
          memberSince: req.user.createdAt
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to load activity.' });
  }
});

module.exports = router;
