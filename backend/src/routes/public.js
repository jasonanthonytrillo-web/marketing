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

    res.json({ success: true, data: tenant });
  } catch (error) {
    console.error('Public Tenant Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
