const fs = require('fs');
const https = require('https');
const path = require('path');

const url = 'https://cdn-icons-png.flaticon.com/512/3061/3061405.png'; // Beautiful Coffee Cup Icon
const dest = path.join(__dirname, 'public', 'favicon.png');

console.log('Downloading beautiful coffee cup favicon...');
const file = fs.createWriteStream(dest);

https.get(url, (response) => {
  if (response.statusCode === 200) {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('✅ Favicon downloaded successfully and saved as public/favicon.png!');
    });
  } else {
    console.error(`Failed to download favicon: HTTP ${response.statusCode}`);
    file.close();
    fs.unlink(dest, () => {});
  }
}).on('error', (err) => {
  file.close();
  fs.unlink(dest, () => {});
  console.error('Error downloading favicon:', err.message);
});
