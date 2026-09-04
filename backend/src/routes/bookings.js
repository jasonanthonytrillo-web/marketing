const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/bookings — Submit a package booking request from a logged-in customer
router.post('/', authenticate, authorize('customer'), async (req, res) => {
  try {
    const { packageId, customerName, customerEmail, customerPhone, eventType, venue, venueLat, venueLng, eventDate, guestCount, locationGuide, notes, paymentMethod, paymentMode } = req.body;
    const parsedPackageId = parseInt(packageId, 10);
    const parsedDate = new Date(eventDate);
    const parsedGuestCount = guestCount ? parseInt(guestCount, 10) : null;

    if (!Number.isInteger(parsedPackageId) || !customerName?.trim() || !customerEmail?.trim() || !eventType?.trim() || !venue?.trim() || !/T\d{2}:\d{2}/.test(eventDate || '') || Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Package, customer details, event type, venue, and both event date and time are required.' });
    }
    if (parsedDate < new Date()) {
      return res.status(400).json({ success: false, message: 'The event date must be in the future.' });
    }
    if (parsedGuestCount !== null && (!Number.isInteger(parsedGuestCount) || parsedGuestCount < 1)) {
      return res.status(400).json({ success: false, message: 'Guest count must be a positive number.' });
    }
    if (!['cash', 'gcash', 'maya'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Choose cash, GCash, or Maya as your payment method.' });
    }
    if (!['downpayment', 'full_payment'].includes(paymentMode)) {
      return res.status(400).json({ success: false, message: 'Choose full payment or downpayment.' });
    }

    const eventPackage = await prisma.eventPackage.findFirst({
      where: { id: parsedPackageId, tenantId: req.tenantId, isActive: true }
    });
    if (!eventPackage) return res.status(404).json({ success: false, message: 'That package is no longer available.' });

    const slotStart = new Date(parsedDate);
    slotStart.setSeconds(0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + 1);
    const existingBooking = await prisma.eventBooking.findFirst({
      where: {
        tenantId: req.tenantId,
        status: { in: ['pending', 'accepted'] },
        eventDate: { gte: slotStart, lt: slotEnd }
      },
      select: { id: true }
    });
    if (existingBooking) {
      return res.status(409).json({ success: false, message: 'That date and time is already booked. Please choose another schedule.' });
    }

    const packageAmount = Number(String(eventPackage.priceText || '').replace(/[^0-9.]/g, ''));
    const paymentAmount = Number.isFinite(packageAmount) && packageAmount > 0
      ? paymentMode === 'downpayment' ? packageAmount / 2 : packageAmount
      : null;

    const booking = await prisma.eventBooking.create({
      data: {
        tenantId: req.tenantId,
        packageId: parsedPackageId,
        customerId: req.user.id,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone?.trim() || null,
        eventType: eventType.trim(),
        venue: venue.trim(),
        venueLat: Number.isFinite(Number(venueLat)) ? Number(venueLat) : null,
        venueLng: Number.isFinite(Number(venueLng)) ? Number(venueLng) : null,
        eventDate: parsedDate,
        guestCount: parsedGuestCount,
        locationGuide: locationGuide?.trim() || null,
        notes: notes?.trim() || null,
        paymentMethod,
        paymentMode,
        paymentAmount
      },
      include: { package: { select: { name: true } } }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'submit_package_booking',
        entityType: 'package_booking',
        entityId: String(booking.id),
        details: `Requested ${eventPackage.name} for ${booking.eventDate.toISOString().split('T')[0]}`
      }
    });

    if (req.io) {
      req.io.to(`tenant-${req.tenantId}-admin`).emit('admin_notification_update');
    }

    res.status(201).json({ success: true, data: booking, message: 'Booking request sent to the admin for approval.' });
  } catch (error) {
    console.error('Package booking error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit booking request.' });
  }
});

// GET /api/bookings/availability — Reserved event date/time slots for the current tenant
router.get('/availability', authenticate, authorize('customer'), async (req, res) => {
  try {
    const bookings = await prisma.eventBooking.findMany({
      where: { tenantId: req.tenantId, status: { in: ['pending', 'accepted'] }, eventDate: { gte: new Date() } },
      select: { eventDate: true }
    });
    res.json({ success: true, data: bookings.map(booking => booking.eventDate) });
  } catch (error) {
    console.error('Booking availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to load booking availability.' });
  }
});

// GET /api/bookings/mine — Customer booking history
router.get('/mine', authenticate, authorize('customer'), async (req, res) => {
  try {
    const bookings = await prisma.eventBooking.findMany({
      where: { tenantId: req.tenantId, customerId: req.user.id },
      include: { package: { select: { name: true, priceText: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Customer bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to load booking requests.' });
  }
});

// POST /api/bookings/:id/payment — Customer submits the last 4 GCash reference digits
router.post('/:id/payment', authenticate, authorize('customer'), async (req, res) => {
  try {
    const reference = String(req.body.reference || '').trim();
    if (!/^\d{4}$/.test(reference)) {
      return res.status(400).json({ success: false, message: 'Enter the 4-digit GCash reference ID.' });
    }

    const booking = await prisma.eventBooking.findFirst({
      where: { id: parseInt(req.params.id, 10), tenantId: req.tenantId, customerId: req.user.id },
      include: { package: { select: { name: true } } }
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking request not found.' });
    if (booking.paymentStatus !== 'awaiting_payment' && booking.paymentStatus !== 'rejected') {
      return res.status(400).json({ success: false, message: 'This booking is not waiting for a payment reference.' });
    }

    const updated = await prisma.eventBooking.update({
      where: { id: booking.id },
      data: { paymentReference: reference, paymentStatus: 'submitted', paymentSubmittedAt: new Date() },
      include: { package: { select: { name: true } } }
    });

    if (req.io) req.io.to(`tenant-${req.tenantId}-admin`).emit('admin_notification_update');
    res.json({ success: true, data: updated, message: 'Payment reference sent to the admin for verification.' });
  } catch (error) {
    console.error('Package payment submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit payment reference.' });
  }
});

module.exports = router;
