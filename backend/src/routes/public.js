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
    
    // Resolve the Frontend URL 
    const baseUrl = 'https://elevatepos.vercel.app';
    const redirectUrl = `${baseUrl}/menu?tenant=${slug}`;
    
    // Resolve the full OG Image URL (must be absolute)
    let ogImage = tenant.ogImage || tenant.logo;
    
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        
        <!-- Primary Meta Tags -->
        <meta name="title" content="${title}">
        <meta name="description" content="${description}">

        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${redirectUrl}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${ogImage}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:url" content="${redirectUrl}">
        <meta property="twitter:title" content="${title}">
        <meta property="twitter:description" content="${description}">
        <meta property="twitter:image" content="${ogImage}">

        <!-- Immediate Redirect for Humans -->
        <script>
          // Only redirect if NOT a scraper bot (simple check)
          if (!/bot|googlebot|crawler|spider|robot|crawling|facebookexternalhit|facebookcatalog/i.test(navigator.userAgent)) {
            window.location.href = "${redirectUrl}";
          }
        </script>
        <meta http-equiv="refresh" content="3;url=${redirectUrl}">
      </head>
      <body style="background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center;">
        <div>
          <div style="width: 60px; height: 60px; border: 4px solid #f97316; border-top-color: transparent; border-radius: 50%; animate: spin 1s linear infinite; margin: 0 auto 20px;"></div>
          <h2 style="font-weight: 900; letter-spacing: -0.05em;">WELCOME TO ${title.toUpperCase()}</h2>
          <p style="color: #666; font-size: 14px;">Redirecting you to our menu...</p>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Share Bridge Error:', error);
    res.redirect('/');
  }
});

module.exports = router;
