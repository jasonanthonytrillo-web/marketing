const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = '542194625185-rd9qq05qqgej9n6qkhlgcdgfagid601l.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);



// POST /api/auth/login
router.post('/login', async (req, res) => {
  console.log('Login attempt received for:', req.body.email);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // TENANT DETECTION: Determine which shop the user is trying to log into
    const { tenantSlug } = req.body;
    let tenantId = 1; // Default
    if (tenantSlug && tenantSlug !== 'project-million') {
      const tenantRecord = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenantRecord) tenantId = tenantRecord.id;
    }

    // FIND USER: Look for the email specifically within this store
    const user = await prisma.user.findFirst({ 
      where: { 
        email,
        OR: [
          { tenantId: tenantId },
          { role: 'superadmin' } // Superadmins can log in from anywhere
        ]
      },
      include: { tenant: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // TENANT SECURITY CHECK: 
    // If a tenantSlug is provided, the user MUST belong to that tenant (Superadmins bypass this).
    if (user.role !== 'superadmin' && tenantSlug && tenantSlug !== 'project-million') {
      if (user.tenant?.slug !== tenantSlug) {
        return res.status(403).json({ 
          success: false, 
          message: `Access denied. This account does not belong to ${tenantSlug.replace(/-/g, ' ')}.` 
        });
      }
    }

    if (!user.active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Audit log
    try {
      await prisma.auditLog.create({
        data: { 
          userId: user.id, 
          action: 'login', 
          entityType: 'user', 
          entityId: user.id.toString(),
          details: `User ${user.name} logged in as ${user.role} at ${user.tenant?.name || 'Project Million'}`
        }
      });
    } catch (auditError) {
      console.error('Audit log failed:', auditError);
    }

    res.json({
      success: true,
      data: {
        token,
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant?.name,
          tenantSlug: user.tenant?.slug,
          tenantLogo: user.tenant?.logo,
          tenantFavicon: user.tenant?.favicon,
          points: user.points || 0,
          isGoogle: user.isGoogle
        }
      }
    });
  } catch (error) {
    console.error('Login crash details:', error);
    res.status(500).json({ success: false, message: error.message || 'Login failed.' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { token, tenantSlug } = req.body;
    
    if (!token) return res.status(400).json({ success: false, message: 'Google token required' });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;

    // Resolve Tenant ID based on slug
    let tenantId = 1; // Default
    if (tenantSlug && tenantSlug !== 'project-million') {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }

    // Find user by email WITHIN this specific tenant
    let user = await prisma.user.findFirst({ 
      where: { email, tenantId },
      include: { tenant: true }
    });

    // If user exists but isGoogle isn't set, update it
    if (user && !user.isGoogle) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isGoogle: true },
        include: { tenant: true }
      });
    }

    // If user doesn't exist, auto-register as customer
    if (!user) {
      // Create a random complex password since they use Google
      const randomPass = await bcrypt.hash(Math.random().toString(36).slice(-10) + 'GoOgLe', 12);
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: randomPass,
          role: 'customer',
          tenantId,
          isGoogle: true
        },
        include: { tenant: true }
      });
    }

    if (!user.active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token: jwtToken,
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant?.name,
          tenantSlug: user.tenant?.slug,
          tenantLogo: user.tenant?.logo,
          tenantFavicon: user.tenant?.favicon,
          points: user.points || 0,
          isGoogle: user.isGoogle
        }
      }
    });

  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ success: false, message: 'Google Authentication failed.' });
  }
});

// POST /api/auth/register-customer (Public)
router.post('/register-customer', async (req, res) => {
  try {
    const { email, password, name, tenantSlug } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Resolve tenantId from slug
    let tenantId = 1;
    if (tenantSlug && tenantSlug !== 'project-million') {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }

    const existing = await prisma.user.findFirst({ where: { email, tenantId } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered in this store.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'customer',
        points: 0,
        tenantId: tenantId
      }
    });

    res.status(201).json({ 
      success: true, 
      message: 'Account created! Please log in.',
      data: { id: user.id, name: user.name, email: user.email } 
    });
  } catch (error) {
    console.error('Customer Register error:', error);
    res.status(500).json({ success: false, message: 'Failed to create account.' });
  }
});

// POST /api/auth/register (admin only)
router.post('/register', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const { email, password, name, role, pin } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password, and name are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const hashedPin = pin ? await bcrypt.hash(pin, 12) : null;

    // SECURITY: Only superadmins can create other superadmins
    let finalRole = role || 'cashier';
    if (finalRole === 'superadmin' && req.user.role !== 'superadmin') {
      finalRole = 'admin';
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: finalRole,
        pin: hashedPin,
        points: 0,
        tenantId: req.user.tenantId // IMPORTANT: Bind to the creator's tenant
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, points: true, tenantId: true }
    });

    await prisma.auditLog.create({
      data: { 
        userId: req.user.id, 
        action: 'create_user', 
        entityType: 'user', 
        entityId: user.id.toString(), 
        details: `Created user: ${name} (${finalRole}) for Tenant ID: ${req.user.tenantId}` 
      }
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { tenant: true }
    });

    res.json({ 
      success: true, 
      data: {
        ...fullUser,
        isGoogle: fullUser.isGoogle,
        tenantName: fullUser.tenant?.name
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.isGoogle) {
      return res.status(400).json({ success: false, message: 'Password cannot be changed for Google accounts.' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Incorrect current password.' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword }
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'change_password', entityType: 'user', entityId: user.id.toString(), details: 'User changed their password' }
    });

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

module.exports = router;
