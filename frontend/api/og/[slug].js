// Vercel Serverless Function — serves OG meta tags for social media crawlers
// When shared on Facebook/Messenger, this URL shows the tenant's OG image
// Regular users get instantly redirected to the actual SPA

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.redirect('/');
  }

  // Try both env var names (VITE_ is build-time, but Vercel makes all env vars available to serverless)
  const apiUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:5000/api';

  let title = 'PROJECT MILLION';
  let description = 'Professional Multi-Tenant Point of Sale System';
  let image = 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png';

  try {
    const response = await fetch(`${apiUrl}/public/tenant/${slug}`);
    const data = await response.json();

    if (data.success && data.data) {
      const tenant = data.data;
      title = tenant.name || title;
      description = `Order from ${title} — Self-Service Kiosk`;
      image = tenant.ogImage || tenant.logo || image;
    }
  } catch (e) {
    // Fallback to defaults if API call fails
    console.error('OG fetch error:', e.message);
  }

  const siteUrl = `https://${req.headers.host}/?tenant=${slug}`;

  // Return HTML with OG tags + instant redirect for regular users
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${siteUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${siteUrl}" />
</head>
<body>
  <p>Redirecting to <a href="${siteUrl}">${title}</a>...</p>
</body>
</html>`);
}
