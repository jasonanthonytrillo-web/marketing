export default function handler(req, res) {
  const title = 'HOMETOWN BREW POS';
  const description = 'Professional Point of Sale System';
  const redirectUrl = `https://hometownbrew.jasonanthonytrillo.workers.dev/`;
  const ogImage = 'https://hometownbrew.jasonanthonytrillo.workers.dev/favicon.png';

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Robots-Tag', 'all');
  
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta property="og:title" content="${title}">
      <meta property="og:description" content="${description}">
      <meta property="og:image" content="${ogImage}">
      <meta property="og:url" content="${redirectUrl}">
      <meta property="og:type" content="website">
      <meta name="twitter:card" content="summary_large_image">
      <meta http-equiv="refresh" content="0;url=${redirectUrl}">
    </head>
    <body style="background: #000; color: #fff; font-family: sans-serif; text-align: center; padding-top: 20%;">
      <h2>Redirecting to ${title}...</h2>
      <script>window.location.href = "${redirectUrl}";</script>
    </body>
    </html>
  `);
}
