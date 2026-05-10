const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Fetch tenant branding for the landing page
router.get('/tenant/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { slug: slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        favicon: true,
        ogImage: true,
        primaryColor: true,
        secondaryColor: true,
        bannerImage: true,
        bannerAssets: true,
        active: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Fetch landing description from settings
    const setting = await prisma.systemSetting.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: 'landing_description' } }
    });
    
    tenant.landing_description = setting ? setting.value : null;

    res.json({ success: true, data: tenant });
  } catch (error) {
    console.error('Public Tenant Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Dynamic PWA Manifest for store-specific installation
router.get('/manifest/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { name: true, logo: true, primaryColor: true }
    });

    const manifest = {
      short_name: tenant?.name || "Project Million",
      name: tenant?.name || "Project Million POS",
      description: `Official App for ${tenant?.name || 'Project Million'}`,
      icons: [
        {
          "src": tenant?.logo || "https://cdn-icons-png.flaticon.com/512/5787/5787016.png",
          "type": "image/png",
          "sizes": "192x192",
          "purpose": "any maskable"
        },
        {
          "src": tenant?.logo || "https://cdn-icons-png.flaticon.com/512/5787/5787016.png",
          "type": "image/png",
          "sizes": "512x512",
          "purpose": "any maskable"
        }
      ],
      start_url: `/?tenant=${slug}`,
      display: "standalone",
      theme_color: tenant?.primaryColor || "#f97316",
      background_color: "#ffffff"
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.json(manifest);
  } catch (error) {
    console.error('Manifest Error:', error);
    res.status(500).json({ success: false, message: 'Manifest error' });
  }
});

// Social Share Bridge - Serves dynamic OG tags for social media scrapers
router.get('/share/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { slug }
    });

    if (!tenant) return res.redirect('/');

    // Fetch custom description for social media
    const setting = await prisma.systemSetting.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: 'landing_description' } }
    });
    
    const title = tenant.name;
    const description = setting?.value || `Order fresh food from ${tenant.name} - Skip the line and order online!`;
    const host = req.get('host');
    const protocol = req.protocol === 'http' && host.includes('localhost') ? 'http' : 'https';
    
    // Resolve the Frontend URL (Priority: Env Var > Request Host)
    const baseUrl = (process.env.FRONTEND_URL || `${protocol}://${host}`).replace(/\/$/, '');
    const redirectUrl = `${baseUrl}/?tenant=${slug}`;
    
    // Resolve the full OG Image URL (must be absolute)
    let ogImage = tenant.ogImage || tenant.logo;
    
    // Default fallback for Burger Palace
    if (!ogImage && slug === 'burger-palace') {
      ogImage = '/og-default.png';
    }
    
    if (!ogImage) {
      ogImage = 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png';
    }

    if (ogImage.startsWith('/')) {
      ogImage = `${protocol}://${host}${ogImage}`;
    }

    // Serve a meta-only page that redirects to the actual landing page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${redirectUrl}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${ogImage}">
        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:url" content="${redirectUrl}">
        <meta property="twitter:title" content="${title}">
        <meta property="twitter:description" content="${description}">
        <meta property="twitter:image" content="${ogImage}">
        <!-- Immediate Redirect -->
        <script>window.location.href = "${redirectUrl}";</script>
        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
      </head>
      <body style="background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-center; height: 100vh; margin: 0;">
        <div style="text-align: center; width: 100%;">
          <p>Redirecting to ${title}...</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Share Bridge Error:', error);
    res.redirect('/');
  }
});

module.exports = router;
