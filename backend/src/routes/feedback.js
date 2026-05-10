const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

// POST /api/feedback/submit — Submit feedback for an order
router.post('/submit', async (req, res) => {
  try {
    const { orderNumber, rating, comment } = req.body;

    if (!orderNumber || !rating) {
      return res.status(400).json({ success: false, message: 'Order number and rating are required.' });
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { orderNumber }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Update the order with feedback
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        feedbackRating: parseInt(rating),
        feedbackComment: comment || null
      }
    });

    // Emit real-time update to admin
    if (req.io) {
      req.io.to(`tenant_${order.tenantId}_admin`).emit('new_feedback', {
        orderNumber: updatedOrder.orderNumber,
        rating: updatedOrder.feedbackRating,
        comment: updatedOrder.feedbackComment
      });
    }

    res.json({ 
      success: true, 
      message: 'Thank you for your feedback!',
      data: { rating: updatedOrder.feedbackRating }
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit feedback.' });
  }
});

// GET /api/feedback/stats — Get feedback stats for a tenant
router.get('/stats', authenticate, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const feedbackOrders = await prisma.order.findMany({
      where: {
        tenantId,
        feedbackRating: { not: null }
      },
      select: {
        orderNumber: true,
        customerName: true,
        feedbackRating: true,
        feedbackComment: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const stats = await prisma.order.aggregate({
      where: {
        tenantId,
        feedbackRating: { not: null }
      },
      _avg: { feedbackRating: true },
      _count: { feedbackRating: true }
    });

    res.json({
      success: true,
      data: {
        recent: feedbackOrders,
        averageRating: stats._avg.feedbackRating || 0,
        totalReviews: stats._count.feedbackRating || 0
      }
    });
  } catch (error) {
    console.error('Feedback stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load feedback stats.' });
  }
});

module.exports = router;
