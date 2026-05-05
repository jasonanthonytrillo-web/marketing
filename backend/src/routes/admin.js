const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const fs = require('fs');
const path = require('path');

const supabase = require('../lib/supabase');

// Media Upload (Base64) - Supports Images and Videos - Now Using Supabase Storage!
router.post('/upload-image', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { image, name } = req.body;
    if (!image) return res.status(400).json({ success: false, message: 'No media provided' });

    // Detect type and extension
    const match = image.match(/^data:(\w+)\/(\w+);base64,/);
    if (!match) return res.status(400).json({ success: false, message: 'Invalid file format' });
    
    const type = match[1]; 
    const extension = match[2];
    const mimeType = `${type}/${extension}`;
    
    const base64Data = image.split(';base64,').pop();
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `${req.user.tenantId || 'global'}/${Date.now()}-${name?.replace(/\s+/g, '-').toLowerCase() || 'media'}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('pos-media')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('Supabase Upload Error:', error);
      return res.status(500).json({ success: false, message: 'Storage upload failed. Ensure "pos-media" bucket exists and is public.' });
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('pos-media')
      .getPublicUrl(fileName);

    res.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload media' });
  }
});
router.get('/orders', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const where = { tenantId: req.user.tenantId };
    if (status && status !== 'all') where.status = status;
    const orders = await prisma.order.findMany({
      where,
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });
    const total = await prisma.order.count({ where });
    res.json({ success: true, data: orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load orders.' });
  }
});

// Products CRUD
router.get('/products', authenticate, authorize('admin'), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { tenantId: req.user.tenantId },
      include: { category: true, addons: true },
      orderBy: { sortOrder: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load products.' });
  }
});

router.post('/products', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, price, image, categoryId, stock, available, pointsCost, addons } = req.body;
    if (!name || !price || !categoryId) {
      return res.status(400).json({ success: false, message: 'Name, price, and category are required.' });
    }
    const product = await prisma.product.create({
      data: {
        tenantId: req.user.tenantId,
        name, description, price: parseFloat(price), image,
        categoryId: parseInt(categoryId), stock: parseInt(stock) || 100,
        available: available !== false,
        pointsCost: pointsCost ? parseInt(pointsCost) : null,
        addons: addons ? { create: addons.map(a => ({ tenantId: req.user.tenantId, name: a.name, price: parseFloat(a.price) })) } : undefined
      },
      include: { category: true, addons: true }
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'create_product', entityType: 'product', entityId: product.name, details: `Created new product "${product.name}" in category "${product.category?.name || 'N/A'}" at ₱${product.price}` }
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to create product.' });
  }
});

router.put('/products/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, price, image, categoryId, stock, available, pointsCost, addons } = req.body;

    // Handle addons: Delete old ones and create new ones (sync)
    if (addons) {
      await prisma.productAddon.deleteMany({
        where: { 
          productId: parseInt(req.params.id),
          tenantId: req.user.tenantId // DEFENSIVE: Ensure we only delete our own addons
        }
      });
    }

    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id), tenantId: req.user.tenantId },
      data: {
        name, description, price: price ? parseFloat(price) : undefined,
        image, categoryId: categoryId ? parseInt(categoryId) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined, 
        available,
        pointsCost: pointsCost !== undefined ? (pointsCost ? parseInt(pointsCost) : null) : undefined,
        addons: addons ? { 
          create: addons.map(a => ({ 
            tenantId: req.user.tenantId, 
            name: a.name, 
            price: parseFloat(a.price) 
          })) 
        } : undefined
      },
      include: { category: true, addons: true }
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'update_product', entityType: 'product', entityId: product.name, details: `Updated product "${product.name}": Price=₱${product.price}, Stock=${product.stock}, Active=${product.available}` }
    });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
});

router.delete('/products/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    // Perform SOFT DELETE (Archive)
    const product = await prisma.product.update({
      where: { id: productId, tenantId: req.user.tenantId },
      data: { available: false }
    });

    await prisma.auditLog.create({
      data: { 
        userId: req.user.id, 
        tenantId: req.user.tenantId,
        action: 'archive_product', 
        entityType: 'product', 
        entityId: product.name, 
        details: `Archived product "${product.name}"` 
      }
    });

    res.json({ success: true, message: 'Product moved to archive.' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ success: false, message: 'Failed to archive product.' });
  }
});

// Staff CRUD
router.get('/staff', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, points: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load staff.' });
  }
});

router.post('/staff', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { tenantId: req.user.tenantId, name, email, password: hashedPassword, role, points: role === 'customer' ? 0 : undefined },
      select: { id: true, email: true, name: true, role: true, active: true, points: true }
    });

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'create_staff', entityType: 'user', entityId: user.name, details: `Created new ${user.role}: ${user.name} (${user.email})` }
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
});

router.put('/staff/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, email, role, active, password } = req.body;
    const data = { name, email, role, active };
    if (password) data.password = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data,
      select: { id: true, email: true, name: true, role: true, active: true }
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'update_staff', entityType: 'staff', entityId: user.name, details: `Updated staff "${user.name}" (${user.email}): Role=${user.role}, Active=${user.active}` }
    });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update staff.' });
  }
});

router.delete('/staff/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await prisma.user.update({ where: { id: parseInt(req.params.id) }, data: { active: false } });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'deactivate_staff', entityType: 'user', entityId: parseInt(req.params.id), details: `Deactivated staff ID: ${req.params.id}` }
    });
    res.json({ success: true, message: 'Staff deactivated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to deactivate staff.' });
  }
});

// Inventory
router.get('/inventory', authenticate, authorize('admin'), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true, name: true, stock: true, available: true, category: { select: { name: true } } },
      orderBy: { stock: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load inventory.' });
  }
});

router.post('/inventory/:id/restock', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: { stock: { increment: parseInt(quantity) } }
    });
    await prisma.inventoryLog.create({
      data: { productId: product.id, quantityChange: parseInt(quantity), reason: 'restock', staffId: req.user.id }
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'restock_product', entityType: 'product', entityId: product.id, details: `Added ${quantity} units to ${product.name}` }
    });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to restock.' });
  }
});

// Audit logs
router.get('/audit-logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { tenantId: req.user.tenantId },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load audit logs.' });
  }
});

// GET /api/admin/settings — Get system settings
router.get('/settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { tenantId: req.user.tenantId }
    });
    const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    
    // Include tenant branding
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId }
    });
    
    if (tenant) {
      settingsMap.tenant_name = tenant.name;
      settingsMap.tenant_logo = tenant.logo;
      settingsMap.tenant_favicon = tenant.favicon;
      settingsMap.tenant_og_image = tenant.ogImage;
      settingsMap.tenant_banner = tenant.bannerImage;
      settingsMap.tenant_assets = tenant.bannerAssets || [];
      settingsMap.primary_color = tenant.primaryColor;
      settingsMap.secondary_color = tenant.secondaryColor;
    }

    res.json({ success: true, data: settingsMap });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load settings.' });
  }
});

// POST /api/admin/settings — Update system settings
router.post('/settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { settings } = req.body; // { key: value }
    
    const brandingMap = {
      tenant_name: 'name',
      tenant_logo: 'logo',
      tenant_favicon: 'favicon',
      tenant_og_image: 'ogImage',
      tenant_banner: 'bannerImage',
      tenant_assets: 'bannerAssets',
      primary_color: 'primaryColor',
      secondary_color: 'secondaryColor'
    };

    const brandingUpdate = {};
    const regularSettings = {};

    for (const [key, value] of Object.entries(settings)) {
      if (brandingMap[key]) {
        const field = brandingMap[key];
        // SECURITY: Only superadmins can change critical branding
        if (['name', 'logo', 'favicon'].includes(field) && req.user.role !== 'superadmin') {
          continue;
        }
        brandingUpdate[field] = value;
      } else {
        regularSettings[key] = value;
      }
    }

    // Update Tenant branding if needed
    if (Object.keys(brandingUpdate).length > 0) {
      await prisma.tenant.update({
        where: { id: req.user.tenantId },
        data: brandingUpdate
      });
    }

    // Update regular system settings
    for (const [key, value] of Object.entries(regularSettings)) {
      await prisma.systemSetting.upsert({
        where: { tenantId_key: { tenantId: req.user.tenantId, key } },
        update: { value: value.toString() },
        create: { tenantId: req.user.tenantId, key, value: value.toString() }
      });
    }

    await prisma.auditLog.create({
      data: { 
        userId: req.user.id, 
        action: 'update_settings', 
        entityType: 'system', 
        details: `Updated settings and branding: ${Object.keys(settings).join(', ')}` 
      }
    });

    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('Save Settings Error:', error);
    res.status(500).json({ success: false, message: 'Failed to save settings.' });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { 
        tenantId: req.user.tenantId 
      },
      include: {
        user: {
          select: { name: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Audit Log Error:', error);
    res.status(500).json({ success: false, message: 'Failed to load audit logs.' });
  }
});

// Combo Options Management
router.get('/products/:id/combo-options', authenticate, authorize('admin'), async (req, res) => {
  try {
    const options = await prisma.comboOption.findMany({
      where: { comboId: parseInt(req.params.id), tenantId: req.user.tenantId },
      include: { product: true }
    });
    res.json({ success: true, data: options });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load combo options.' });
  }
});

router.post('/products/:id/combo-options', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { options } = req.body; // Array of { productId, groupNumber, priceBonus }
    const comboId = parseInt(req.params.id);

    // 1. Delete existing options
    await prisma.comboOption.deleteMany({
      where: { comboId: comboId, tenantId: req.user.tenantId }
    });

    // 2. Create new options
    const created = await prisma.comboOption.createMany({
      data: options.map(opt => ({
        tenantId: req.user.tenantId,
        comboId: comboId,
        productId: parseInt(opt.productId),
        groupNumber: parseInt(opt.groupNumber),
        priceBonus: parseFloat(opt.priceBonus) || 0
      }))
    });

    res.json({ success: true, data: created });
  } catch (error) {
    console.error('Combo Options Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update combo options.' });
  }
});

module.exports = router;
