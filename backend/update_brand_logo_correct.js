require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Connecting to Supabase via Direct Client...');
  const tenant = await prisma.tenant.update({
    where: { slug: 'project-million' },
    data: {
      logo: '/hb_logo.jpg',
      favicon: '/hb_logo.jpg'
    }
  });
  console.log('✅ Success! Logo successfully updated to:', tenant.logo);
}

main()
  .catch(e => {
    console.error('❌ Database Update Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
