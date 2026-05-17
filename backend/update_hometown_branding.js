// Set DATABASE_URL to DIRECT_URL for direct connection
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
} else {
  // If running locally, let's load from .env file manually
  const fs = require('fs');
  const path = require('path');
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const directLine = envFile.split('\n').find(line => line.startsWith('DIRECT_URL='));
    if (directLine) {
      const directUrl = directLine.split('DIRECT_URL=')[1].replace(/"/g, '').trim();
      process.env.DATABASE_URL = directUrl;
      console.log('🔗 Switched connection to Direct URL:', directUrl.split('@')[1]);
    }
  } catch (err) {
    console.error('Could not load .env directly:', err.message);
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('☕ Updating master tenant name to Hometown Brew...');

  const tenant = await prisma.tenant.update({
    where: { slug: 'project-million' },
    data: {
      name: 'Hometown Brew'
    }
  });

  console.log('✅ Master tenant updated successfully:', tenant.name);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
