const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/bookings — Submit a package booking request from a logged-in customer
router.post('/', authenticate, authorize('customer'), async (req, res) => {
  try {
    const { packageId, customerName, customerEmail, customerPhone, eventType, venue, eventDate, guestCount, notes } = req.body;
    const parsedPackageId = parseInt(packageId, 10);
    const parsedDate = new Date(eventDate);
    const parsedGuestCount = guestCount ? parseInt(guestCount, 10) : null;

    if (!Number.isInteger(parsedPackageId) || !customerName?.trim() || !customerEmail?.trim() || !eventType?.trim() || !venue?.trim() || Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Package, customer details, event type, venue, and event date are required.' });
    }
    if (parsedDate < new Date()) {
      return res.status(400).json({ success: false, message: 'The event date must be in the future.' });
    }
    if (parsedGuestCount !== null && (!Number.isInteger(parsedGuestCount) || parsedGuestCount < 1)) {
      return res.status(400).json({ success: false, message: 'Guest count must be a positive number.' });
    }

    const eventPackage = await prisma.eventPackage.findFirst({
      where: { id: parsedPackageId, tenantId: req.tenantId, isActive: true }
    });
    if (!eventPackage) return res.status(404).json({ success: false, message: 'That package is no longer available.' });

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
        eventDate: parsedDate,
        guestCount: parsedGuestCount,
        notes: notes?.trim() || null
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

module.exports = router;
