const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function update() {
  console.log('🔄 Updating production branding...');

  // Burger Palace - Juicy Burger
  await prisma.tenant.update({
    where: { slug: 'burger-palace' },
    data: {
      bannerImage: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2000&auto=format&fit=crop',
      logo: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
      favicon: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
      primaryColor: '#eab308'
    }
  });

  // Project Million - Modern Tech/Food Corner
  await prisma.tenant.update({
    where: { slug: 'project-million' },
    data: {
      bannerImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2000&auto=format&fit=crop',
      logo: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      favicon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      primaryColor: '#4f46e5'
    }
  });

  console.log('✅ Branding updated successfully.');
}

update().catch(console.error).finally(() => prisma.$disconnect());
