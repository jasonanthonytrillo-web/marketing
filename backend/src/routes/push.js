const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const webpush = require('web-push');

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:' + (process.env.EMAIL_USER || 'admin@hometownbrew.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Get the public VAPID key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications (associated with an order)
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, orderId } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object.' });
    }

    const { endpoint, keys: { p256dh, auth } } = subscription;

    // Save or update subscription
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, orderId: orderId ? parseInt(orderId) : null },
      create: { 
        endpoint, 
        p256dh, 
        auth, 
        orderId: orderId ? parseInt(orderId) : null 
      }
    });

    res.status(201).json({ success: true, message: 'Subscription saved.' });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ success: false, message: 'Failed to subscribe.' });
  }
});

// Helper function to send push notifications
const sendPushToOrder = async (orderId, payload) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { orderId: parseInt(orderId) }
    });

    if (subscriptions.length === 0) return false;

    const payloadString = JSON.stringify(payload);
    
    // Send in parallel
    const promises = subscriptions.map(sub => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      return webpush.sendNotification(pushSub, payloadString).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription has expired or is no longer valid, delete it
          return prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        console.error('Error sending push:', err);
      });
    });

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Push Broadcast Error:', error);
    return false;
  }
};

module.exports = {
  router,
  sendPushToOrder
};
