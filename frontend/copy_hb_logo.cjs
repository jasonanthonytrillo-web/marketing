const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\USER\\Downloads\\hb logo.jpg';
const dest = path.join(__dirname, 'public', 'favicon.png');

console.log('Copying Hometown Brew logo from Downloads...');
try {
  if (!fs.existsSync(src)) {
    console.error(`❌ Source file not found at: ${src}`);
    process.exit(1);
  }
  
  fs.copyFileSync(src, dest);
  console.log('✅ Logo copied successfully to public/favicon.png!');
} catch (err) {
  console.error('❌ Failed to copy logo:', err.message);
  process.exit(1);
}
