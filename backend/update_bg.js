const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const source = "C:\\Users\\USER\\.gemini\\antigravity\\brain\\ade19bf6-339a-4f5c-9299-5430458c5fcd\\burger_palace_background_1777925558307.png";
  const destDir = path.join(__dirname, 'uploads');
  const destName = 'burger-palace-bg.png';
  const destPath = path.join(destDir, destName);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    fs.copyFileSync(source, destPath);
    console.log('✅ Image copied to:', destPath);

    const imageUrl = `http://localhost:5000/uploads/${destName}`;
    
    const updated = await prisma.tenant.update({
      where: { slug: 'burger-palace' },
      data: { bannerImage: imageUrl }
    });

    console.log('✅ Database updated for:', updated.name);
    console.log('🚀 New Banner Image:', updated.bannerImage);
  } catch (err) {
    console.error('❌ Error during update:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
