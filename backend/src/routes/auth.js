const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = '542194625185-rd9qq05qqgej9n6qkhlgcdgfagid601l.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const { sendOTPEmail } = require('../lib/mailer');
const rateLimit = require('../middleware/rateLimiter');

const otpLimiter = rateLimit(60 * 1000, 5, 'Too many OTP requests. Please wait 1 minute before requesting again.');
// Keep an IP emergency limit, while account-level failures below control CAPTCHA and lockouts.
// A low limit here would block valid credentials before the account security flow can run.
const loginLimiter = rateLimit(60 * 1000, 30, 'Too many login requests. Please try again in 1 minute.');
const unknownLoginAttempts = new Map();
const UNKNOWN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const UNKNOWN_LOGIN_MAX = 20;

const verifyTurnstile = async (token, remoteIp) => {
  if (!process.env.TURNSTILE_SECRET_KEY || !token) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: remoteIp || '' })
    });
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Turnstile verification failed:', error.message);
    return false;
  }
};




// POST /api/auth/request-otp — Send a code to email
router.post('/request-otp', otpLimiter, async (req, res) => {
  const { email, tenantSlug } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    // Determine tenant
    let tenantId = null;
    let tenantName = 'Hometown Brew';
    if (tenantSlug && tenantSlug !== 'project-million') {
      const tenantRecord = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenantRecord) {
        tenantId = tenantRecord.id;
        tenantName = tenantRecord.name;
      }
    } else {
      const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
      if (masterTenant) tenantId = masterTenant.id;
    }

    // Find user in this tenant
    const user = await prisma.user.findFirst({
      where: { email, tenantId: tenantId }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found in this shop.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpires: expires }
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    await sendOTPEmail(email, otp, tenant || {});

    res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('OTP Request Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
});

// POST /api/auth/verify-otp — Login using code
router.post('/verify-otp', loginLimiter, async (req, res) => {
  const { email, otp, tenantSlug } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

  try {
    // Find tenant
    let tenantId = null;
    if (tenantSlug && tenantSlug !== 'project-million') {
      const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (t) tenantId = t.id;
    } else {
      const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
      if (masterTenant) tenantId = masterTenant.id;
    }

    const user = await prisma.user.findFirst({
      where: { 
        email, 
        tenantId, 
        otpCode: otp, 
        otpExpires: { gt: new Date() } 
      },
      include: { tenant: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired code.' });
    }

    // Clear OTP after success
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpires: null }
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.cookie('pos_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name,
        tenantSlug: user.tenant?.slug,
        points: user.points || 0
      }
    });
  } catch (error) {
    console.error('OTP Verify Error:', error);
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

// POST /api/auth/check-otp — Verify code without clearing it
router.post('/check-otp', async (req, res) => {
  const { email, otp, tenantSlug } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

  try {
    let tenantId = null;
    if (tenantSlug && tenantSlug !== 'project-million') {
      const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (t) tenantId = t.id;
    } else {
      const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
      if (masterTenant) tenantId = masterTenant.id;
    }

    const user = await prisma.user.findFirst({
      where: { 
        email, 
        tenantId, 
        otpCode: otp, 
        otpExpires: { gt: new Date() } 
      }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    res.json({ success: true, message: 'OTP is valid.' });
  } catch (error) {
    console.error('OTP Check Error:', error);
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

// POST /api/auth/reset-password — Reset password using OTP code
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword, tenantSlug } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
  }

  try {
    // Find tenant
    let tenantId = null;
    if (tenantSlug && tenantSlug !== 'project-million') {
      const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (t) tenantId = t.id;
    } else {
      const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
      if (masterTenant) tenantId = masterTenant.id;
    }

    const user = await prisma.user.findFirst({
      where: { 
        email, 
        tenantId, 
        otpCode: otp, 
        otpExpires: { gt: new Date() } 
      }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        otpCode: null, 
        otpExpires: null 
      }
    });

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Password Reset Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  console.log('Login attempt received for:', req.body.email);
  try {
    const { email, password, turnstileToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // TENANT DETECTION: Determine which shop the user is trying to log into
    const { tenantSlug } = req.body;
    let tenantId = null;

    if (tenantSlug && tenantSlug !== 'project-million') {
      const tenantRecord = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenantRecord) tenantId = tenantRecord.id;
    } else {
      // MASTER TENANT: Find the project-million ID dynamically
      const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
      if (masterTenant) tenantId = masterTenant.id;
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
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const now = Date.now();
      const recentAttempts = (unknownLoginAttempts.get(ip) || [])
        .filter(timestamp => now - timestamp < UNKNOWN_LOGIN_WINDOW_MS);
      recentAttempts.push(now);
      unknownLoginAttempts.set(ip, recentAttempts);
      if (recentAttempts.length > UNKNOWN_LOGIN_MAX) {
        return res.status(429).json({ success: false, message: 'Too many login attempts. Please try again later.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const requiresCaptcha = true;

    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      const retryAfter = Math.ceil((user.loginLockedUntil.getTime() - Date.now()) / 1000);
      return res.status(429).json({ success: false, message: `Too many failed attempts. Try again in ${retryAfter} seconds.`, retryAfter });
    }

    if (requiresCaptcha && user.failedLoginAttempts >= 3) {
      const validCaptcha = await verifyTurnstile(turnstileToken, req.ip);
      if (!validCaptcha) {
        return res.status(403).json({ success: false, message: 'Please complete the security check before trying again.', captchaRequired: true });
      }
    }

    // VERIFICATION CHECK: Customers MUST be verified to log in
    if (user.role === 'customer' && !user.isVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email not verified. Please check your inbox or sign up again to receive a new code.',
        unverified: true
      });
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
      if (user.role === 'customer') {
        return res.status(401).json({ success: false, message: 'Your account was banned. Please talk to the staff to restore it.' });
      }
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const lockSeconds = failedLoginAttempts >= 5 ? Math.min(30 * (2 ** (failedLoginAttempts - 5)), 30 * 60) : 0;
      const loginLockedUntil = lockSeconds ? new Date(Date.now() + lockSeconds * 1000) : null;
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts, loginLockedUntil } });
      return res.status(lockSeconds ? 429 : 401).json({
        success: false,
        message: lockSeconds ? `Too many failed attempts. Try again in ${lockSeconds} seconds.` : 'Invalid username or password.',
        retryAfter: lockSeconds || undefined,
        captchaRequired: requiresCaptcha && failedLoginAttempts >= 3
      });
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, loginLockedUntil: null } });

    // DEVICE AUTHORIZATION CHECK: Staff roles must log in from an authorized device
    const restrictedRoles = ['cashier', 'kitchen', 'rider'];
    if (restrictedRoles.includes(user.role)) {
      const { deviceToken } = req.body;
      if (!deviceToken) {
        return res.status(403).json({
          success: false,
          message: 'This device is not authorized for staff login. Please ask your manager to register this device.',
          deviceUnauthorized: true
        });
      }
      const device = await prisma.authorizedDevice.findFirst({
        where: {
          deviceToken,
          tenantId: user.tenantId,
          isActive: true
        }
      });
      if (!device) {
        return res.status(403).json({
          success: false,
          message: 'This device is not authorized for staff login. Please ask your manager to register this device.',
          deviceUnauthorized: true
        });
      }
      // Update last used timestamp
      await prisma.authorizedDevice.update({
        where: { id: device.id },
        data: { lastUsedAt: new Date() }
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('pos_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: { 
          tenantId: user.tenantId || 1,
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
          tenantColor: user.tenant?.primaryColor,
          tenantSecondaryColor: user.tenant?.secondaryColor,
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

    // Resolve Tenant ID based on slug dynamically
    let tenantId = null;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    // Fallback to Master Tenant if slug is missing
    if (!tenantId) {
      const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
      if (masterTenant) tenantId = masterTenant.id;
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
      if (user.role === 'customer') {
        return res.status(401).json({ success: false, message: 'Your account was banned. Please talk to the staff to restore it.' });
      }
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('pos_token', jwtToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });

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
          tenantColor: user.tenant?.primaryColor,
          tenantSecondaryColor: user.tenant?.secondaryColor,
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
router.post('/register-customer', loginLimiter, async (req, res) => {
  try {
    const { email, password, name, tenantSlug } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Resolve tenantId from slug dynamically
    let tenantId = null;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }
    // Fallback to Master Tenant if slug is missing
    if (!tenantId) {
      const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
      if (masterTenant) tenantId = masterTenant.id;
    }

    const existing = await prisma.user.findFirst({ where: { email, tenantId } });
    if (existing && existing.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    // OTP Generation
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user;
    if (existing) {
      console.log('Updating unverified user:', email);
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          password: hashedPassword,
          name,
          otpCode: otp,
          otpExpires: expires,
          isVerified: false
        }
      });
    } else {
      console.log('Creating new unverified user:', email);
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          tenantId,
          role: 'customer',
          otpCode: otp,
          otpExpires: expires,
          isVerified: false
        }
      });
    }

    // Send the email
    console.log('Attempting to send OTP to:', email);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    await sendOTPEmail(email, otp, tenant);

    console.log('OTP Sent Successfully');
    res.status(201).json({ 
      success: true, 
      message: 'OTP sent! Please verify your email to complete registration.',
      email 
    });
  } catch (error) {
    console.error('CRITICAL REGISTRATION ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error during registration.' 
    });
  }
});

// POST /api/auth/resend-registration-otp — Resend registration verification code
router.post('/resend-registration-otp', otpLimiter, async (req, res) => {
  const { email, tenantSlug } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

  try {
    let tenantId = null;
    if (tenantSlug && tenantSlug !== 'project-million') {
      const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (t) tenantId = t.id;
    } else {
      const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
      if (masterTenant) tenantId = masterTenant.id;
    }

    const user = await prisma.user.findFirst({
      where: { email, tenantId, isVerified: false }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No unverified account found with this email.' });
    }

    // Generate brand new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpires: expires }
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    await sendOTPEmail(email, otp, tenant || {});

    res.json({ success: true, message: 'A new verification code has been sent to your Gmail!' });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification code.' });
  }
});

// POST /api/auth/verify-registration — Complete signup
router.post('/verify-registration', async (req, res) => {
  const { email, otp, tenantSlug } = req.body;
  try {
    console.log('--- VERIFICATION ATTEMPT ---');
    console.log('Email:', email);
    console.log('OTP:', otp);
    console.log('TenantSlug:', tenantSlug);

    let tenantId = null;
    if (tenantSlug) {
      const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (t) tenantId = t.id;
    }
    console.log('Resolved TenantId:', tenantId);

    const user = await prisma.user.findFirst({
      where: { 
        email, 
        tenantId,
        otpCode: otp
      }
    });

    if (!user) {
      console.error('❌ User not found with these credentials');
      return res.status(401).json({ success: false, message: 'Invalid or expired code.' });
    }

    if (user.otpExpires < new Date()) {
      console.error('❌ OTP has expired');
      return res.status(401).json({ success: false, message: 'Code has expired. Please sign up again.' });
    }

    console.log('✅ User found, proceeding to verify');

    // Mark as verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, otpCode: null, otpExpires: null },
      include: { tenant: true }
    });

    // Generate login token immediately after verification
    const token = jwt.sign(
      { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role, tenantId: updatedUser.tenantId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.cookie('pos_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        tenantId: updatedUser.tenantId,
        tenantName: updatedUser.tenant?.name,
        tenantSlug: updatedUser.tenant?.slug,
        points: updatedUser.points || 0
      }
    });
  } catch (error) {
    console.error('VERIFICATION CRASH:', error);
    res.status(500).json({ success: false, message: error.message || 'Verification failed.' });
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

    const existing = await prisma.user.findFirst({ 
      where: { 
        email, 
        tenantId: req.tenantId // Use the active tenant context
      } 
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered in this store.' });
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
        tenantId: req.tenantId // Bind to the active tenant context
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, points: true, tenantId: true }
    });

    await prisma.auditLog.create({
      data: { 
        tenantId: req.tenantId,
        userId: req.user.id, 
        action: 'create_user', 
        entityType: 'user', 
        entityId: user.id.toString(), 
        details: `Created user: ${name} (${finalRole}) for Tenant ID: ${req.tenantId}` 
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

    const { password, pin, otpCode, otpExpires, ...sanitizedUser } = fullUser;

    res.json({ 
      success: true, 
      data: {
        ...sanitizedUser,
        isGoogle: fullUser.isGoogle,
        tenantName: fullUser.tenant?.name,
        tenantColor: fullUser.tenant?.primaryColor,
        tenantSecondaryColor: fullUser.tenant?.secondaryColor
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
      data: { 
        tenantId: user.tenantId || 1,
        userId: user.id, 
        action: 'change_password', 
        entityType: 'user', 
        entityId: user.id.toString(), 
        details: 'User changed their password' 
      }
    });

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('pos_token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ========================
// DEVICE MANAGEMENT ROUTES
// ========================

// POST /api/auth/devices/register — Authorize this browser/device (Admin only)
router.post('/devices/register', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { deviceName } = req.body;
    if (!deviceName || !deviceName.trim()) {
      return res.status(400).json({ success: false, message: 'Device name is required (e.g. "Main Counter POS").' });
    }

    // Generate a cryptographically secure token
    const deviceToken = `dev_${crypto.randomUUID()}`;

    const device = await prisma.authorizedDevice.create({
      data: {
        tenantId: req.tenantId,
        deviceToken,
        deviceName: deviceName.trim(),
        addedById: req.user.id
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'register_device',
        entityType: 'device',
        entityId: device.id.toString(),
        details: `Authorized device: ${deviceName.trim()}`
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: device.id,
        deviceToken: device.deviceToken,
        deviceName: device.deviceName,
        createdAt: device.createdAt
      }
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to register device.' });
  }
});

// GET /api/auth/devices — List all authorized devices for this tenant (Admin only)
router.get('/devices', authenticate, authorize('admin'), async (req, res) => {
  try {
    const devices = await prisma.authorizedDevice.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' }
    });

    // Get admin names for addedById
    const adminIds = [...new Set(devices.map(d => d.addedById).filter(Boolean))];
    const admins = adminIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true }
        })
      : [];
    const adminMap = Object.fromEntries(admins.map(a => [a.id, a.name]));

    res.json({
      success: true,
      data: devices.map(d => ({
        id: d.id,
        deviceName: d.deviceName,
        isActive: d.isActive,
        addedBy: adminMap[d.addedById] || 'Unknown',
        lastUsedAt: d.lastUsedAt,
        createdAt: d.createdAt
      }))
    });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch devices.' });
  }
});

// POST /api/auth/devices/:id/revoke — Deactivate a device (Admin only)
router.post('/devices/:id/revoke', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const device = await prisma.authorizedDevice.findFirst({
      where: { id: deviceId, tenantId: req.tenantId }
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    await prisma.authorizedDevice.update({
      where: { id: deviceId },
      data: { isActive: !device.isActive }
    });

    const action = device.isActive ? 'revoke_device' : 'reactivate_device';
    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action,
        entityType: 'device',
        entityId: deviceId.toString(),
        details: `${device.isActive ? 'Revoked' : 'Reactivated'} device: ${device.deviceName}`
      }
    });

    res.json({
      success: true,
      message: device.isActive ? 'Device revoked successfully.' : 'Device reactivated successfully.'
    });
  } catch (error) {
    console.error('Revoke device error:', error);
    res.status(500).json({ success: false, message: 'Failed to update device.' });
  }
});

// DELETE /api/auth/devices/:id — Permanently delete a device (Admin only)
router.delete('/devices/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const device = await prisma.authorizedDevice.findFirst({
      where: { id: deviceId, tenantId: req.tenantId }
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    await prisma.authorizedDevice.delete({ where: { id: deviceId } });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'delete_device',
        entityType: 'device',
        entityId: deviceId.toString(),
        details: `Permanently deleted device: ${device.deviceName}`
      }
    });

    res.json({ success: true, message: 'Device deleted permanently.' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete device.' });
  }
});

module.exports = router;
