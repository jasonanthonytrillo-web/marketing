const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// GET /api/suppliers
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load suppliers.' });
  }
});

// POST /api/suppliers
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address } = req.body;
    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactPerson,
        email,
        phone,
        address,
        tenantId: req.tenantId
      }
    });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create supplier.' });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: { name, contactPerson, email, phone, address }
    });
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update supplier.' });
  }
});

// DELETE /api/suppliers/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await prisma.supplier.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true, message: 'Supplier deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete supplier.' });
  }
});

module.exports = router;
