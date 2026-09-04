export default function handler(req, res) {
  const title = 'HOMETOWN BREW POS';
  const description = 'Professional Point of Sale System';
  const image = 'https://hometownbrew.jasonanthonytrillo.workers.dev/favicon.png';
  const siteUrl = 'https://hometownbrew.jasonanthonytrillo.workers.dev/';

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
  <script>window.location.href = "${siteUrl}";</script>
</body>
</html>`);
}
