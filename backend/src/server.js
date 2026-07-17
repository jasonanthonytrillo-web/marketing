const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const prisma = require('./lib/prisma');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// Test connection on startup
prisma.$connect()
  .then(async () => {
    console.log('✅ Prisma connected to Database');
    await purgeOtherTenants();
  })
  .catch((err) => console.error('❌ Prisma connection FAILED:', err.message));

async function purgeOtherTenants() {
  try {
    const slugsToPurge = ['burger-palace', 'hometownbrew'];
    
    for (const slug of slugsToPurge) {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (tenant) {
        console.log(`🧹 Purging tenant: ${tenant.name} (ID: ${tenant.id}, Slug: ${slug})...`);
        
        // 1. Audit logs
        await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });
        
        // 2. Expenses
        await prisma.expense.deleteMany({ where: { tenantId: tenant.id } });
        
        // 3. System settings
        await prisma.systemSetting.deleteMany({ where: { tenantId: tenant.id } });
        
        // 4. Notifications
        await prisma.notification.deleteMany({
          where: {
            order: {
              tenantId: tenant.id
            }
          }
        });
        
        // 5. Orders (cascades to order items, payments)
        await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
        
        // 6. Inventory logs for products of this tenant
        await prisma.inventoryLog.deleteMany({
          where: {
            product: {
              tenantId: tenant.id
            }
          }
        });
        
        // 7. ComboOptions and ProductAddons
        await prisma.comboOption.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.productAddon.deleteMany({ where: { tenantId: tenant.id } });
        
        // 8. Products
        await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
        
        // 9. Suppliers
        await prisma.supplier.deleteMany({ where: { tenantId: tenant.id } });
        
        // 10. Categories
        await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
        
        // 11. Users (Move superadmins to null, then delete other roles)
        await prisma.user.updateMany({
          where: { tenantId: tenant.id, role: 'superadmin' },
          data: { tenantId: null }
        });
        await prisma.user.deleteMany({
          where: { tenantId: tenant.id, role: { not: 'superadmin' } }
        });
        
        // 12. Finally, the Tenant itself
        await prisma.tenant.delete({ where: { id: tenant.id } });
        console.log(`✅ Successfully purged tenant ${tenant.name} and all associated data.`);
      }
    }
  } catch (error) {
    console.error('❌ Error during tenant purging:', error);
  }
}

const path = require('path');

// Middleware
app.use(cors());
app.use('/api/admin/upload-image', express.json({ limit: '50mb' }));
app.use('/api/admin/upload-image', express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Make io and prisma available to routes
app.set('io', io);
app.set('prisma', prisma);

// Also attach to req for convenience
app.use((req, res, next) => {
  req.io = io;
  req.prisma = prisma;
  
  // SECURE HEADERS FOR GOOGLE LOGIN
  // 'same-origin-allow-popups' allows Google login popups to communicate back to your app
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  // 'unsafe-none' is sometimes needed on localhost to prevent COOP/COEP conflicts
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  next();
});

// Routes
app.use('/share', require('./routes/public')); // For clean social links
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cashier', require('./routes/cashier'));
app.use('/api/kitchen', require('./routes/kitchen'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/rider', require('./routes/rider'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/push', require('./routes/push').router);
app.use('/api/inventory/ingredients', require('./routes/rawIngredients'));

// Socket.io
require('./socket')(io, prisma);

// Robots.txt for Social Scrapers
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.setHeader('X-Robots-Tag', 'all');
  res.send("User-agent: *\nAllow: /");
});

const supabase = require('./lib/supabase');

// Health check with DB ping for Better Stack keeping Supabase awake
app.get('/api/health', async (req, res) => {
  try {
    // A lightweight REST API query using Supabase JS client
    // Supabase explicitly counts REST API (PostgREST) calls as activity to prevent pausing
    await supabase.from('Tenant').select('id').limit(1);
    
    // Fallback: keep Prisma connection alive too
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (error) {
    console.error('Health check DB ping failed:', error.message);
    res.status(500).json({ status: 'error', db: 'disconnected', time: new Date().toISOString() });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 POS Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready`);
});

module.exports = { app, server, io, prisma };
