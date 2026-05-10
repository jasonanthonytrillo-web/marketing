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
  .then(() => console.log('✅ Prisma connected to Database'))
  .catch((err) => console.error('❌ Prisma connection FAILED:', err.message));

const path = require('path');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
app.use('/api/feedback', require('./routes/feedback'));

// Socket.io
require('./socket')(io, prisma);

// Robots.txt for Social Scrapers
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.setHeader('X-Robots-Tag', 'all');
  res.send("User-agent: *\nAllow: /");
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

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
