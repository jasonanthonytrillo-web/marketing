const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
const XENDIT_AUTH = Buffer.from(`${XENDIT_SECRET_KEY}:`).toString('base64');

// POST /api/payments/xendit/create-invoice
router.post('/xendit/create-invoice', async (req, res) => {
  try {
    const { orderId, orderNumber, amount, customerName, paymentMethod } = req.body;

    // Map POS payment methods to Xendit Invoice payment methods
    let xenditMethods = [];
    if (paymentMethod === 'gcash') xenditMethods = ['GCASH'];
    if (paymentMethod === 'maya') xenditMethods = ['PAYMAYA'];
    if (paymentMethod === 'card') xenditMethods = ['CREDIT_CARD'];

    const payload = {
      external_id: `order-${orderId}-${Date.now()}`,
      amount: Math.round(parseFloat(amount) * 100) / 100, // Round to 2 decimals
      description: `Payment for Order #${orderNumber}`,
      customer: {
        given_names: customerName || 'Guest'
      },
      payment_methods: xenditMethods.length > 0 ? xenditMethods : undefined,
      success_redirect_url: `${req.headers.origin}/order/${orderNumber}?paid=true`,
      failure_redirect_url: `${req.headers.origin}/checkout?status=failed`,
      currency: 'PHP',
      reminder_time: 1
    };

    console.log('Sending to Xendit:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${XENDIT_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Xendit Error:', data);
      return res.status(response.status).json({ success: false, message: data.message || 'Xendit error' });
    }

    res.json({ success: true, invoice_url: data.invoice_url, external_id: data.external_id });
  } catch (error) {
    console.error('Payment Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/payments/xendit/webhook (Xendit will call this when paid)
router.post('/xendit/webhook', async (req, res) => {
  try {
    const { external_id, status, amount } = req.body;
    console.log(`💰 Xendit Webhook Received: ${external_id} - ${status}`);

    if (status === 'PAID' || status === 'SETTLED') {
      // Extract order ID from external_id (format: order-ID-timestamp)
      const orderId = parseInt(external_id.split('-')[1]);

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'confirmed', // Move to confirmed so kitchen sees it
          paymentStatus: 'paid'
        },
        include: { items: true }
      });

      // Notify frontend via Socket.io
      const io = req.app.get('io');
      if (io && io.emitOrderUpdate) {
        io.emitOrderUpdate(updatedOrder, 'paid');
      }

      console.log(`✅ Order #${orderId} marked as PAID via Xendit`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

module.exports = router;
