// Vercel Serverless Function — serves tenant-specific PWA manifest
// This makes "Install App" work for tenant URLs like /?tenant=burger-palace

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing tenant slug' });
  }

  const apiUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:5000/api';

  let tenantName = 'Project Million';
  let tenantLogo = 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png';
  let themeColor = '#f97316';

  try {
    const response = await fetch(`${apiUrl}/public/tenant/${slug}`);
    const data = await response.json();

    if (data.success && data.data) {
      tenantName = data.data.name || tenantName;
      tenantLogo = data.data.logo || tenantLogo;
      themeColor = data.data.primaryColor || themeColor;
    }
  } catch (e) {
    console.error('Manifest fetch error:', e.message);
  }

  const manifest = {
    short_name: tenantName,
    name: tenantName,
    description: `Official App for ${tenantName}`,
    icons: [
      {
        src: tenantLogo,
        type: 'image/png',
        sizes: '192x192',
        purpose: 'any'
      },
      {
        src: tenantLogo,
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable'
      }
    ],
    start_url: `/?tenant=${slug}`,
    display: 'standalone',
    theme_color: themeColor,
    background_color: '#ffffff'
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
  res.status(200).json(manifest);
}
