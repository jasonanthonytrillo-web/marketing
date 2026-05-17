// Read .env to get the main connection URL
const fs = require('fs');
const path = require('path');

try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  const dbLine = envFile.split('\n').find(line => line.startsWith('DATABASE_URL='));
  if (dbLine) {
    const dbUrl = dbLine.split('DATABASE_URL=')[1].replace(/"/g, '').trim();
    process.env.DATABASE_URL = dbUrl;
    process.env.DIRECT_URL = dbUrl; // Force direct queries to bypass port 5432
  }
} catch (err) {}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Connecting to Database to set Hometown Brew Landing Video...');

  const tenant = await prisma.tenant.update({
    where: { slug: 'project-million' },
    data: {
      bannerImage: '/hb_video.mp4',
      bannerAssets: JSON.stringify(['/hb_video.mp4'])
    }
  });

  console.log('✅ Database Tenant updated successfully! Banner video path set to:', tenant.bannerImage);
}

main()
  .catch((e) => {
    console.error('❌ Failed to update database video asset:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
