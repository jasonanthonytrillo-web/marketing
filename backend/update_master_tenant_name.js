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
  console.log('🚀 Connecting to Database Pooler (port 6543) to update Master Tenant name...');

  // Update slug: 'project-million' to Name: 'Hometown Brew'
  const tenant = await prisma.tenant.update({
    where: { slug: 'project-million' },
    data: {
      name: 'Hometown Brew',
      primaryColor: '#0a3d01', // Solid brand Deep Forest Green
      secondaryColor: '#0a3d01' // Solid brand Deep Forest Green
    }
  });

  console.log('✅ Database Master Tenant Name updated successfully to:', tenant.name);
}

main()
  .catch((e) => {
    console.error('❌ Failed to update database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
