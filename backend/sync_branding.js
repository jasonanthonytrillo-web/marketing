const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('🔧 Fixing Burger Palace Branding...');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'burger-palace' }
  });

  if (!tenant) {
    console.log('❌ Tenant "burger-palace" not found. Creating it...');
    await prisma.tenant.create({
      data: {
        name: 'BURGER PALACE',
        slug: 'burger-palace',
        primaryColor: '#eab308',
        logo: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        favicon: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        bannerImage: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2000&auto=format&fit=crop'
      }
    });
  } else {
    console.log('✅ Found tenant. Updating name and branding...');
    await prisma.tenant.update({
      where: { slug: 'burger-palace' },
      data: {
        name: 'BURGER PALACE',
        primaryColor: '#eab308',
        logo: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        favicon: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        bannerImage: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2000&auto=format&fit=crop'
      }
    });
  }

  // Also fix Project Million if it's messy
  await prisma.tenant.upsert({
    where: { slug: 'project-million' },
    update: {
      name: 'PROJECT MILLION',
      primaryColor: '#4f46e5',
      bannerImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2000&auto=format&fit=crop'
    },
    create: {
      name: 'PROJECT MILLION',
      slug: 'project-million',
      primaryColor: '#4f46e5',
      bannerImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2000&auto=format&fit=crop'
    }
  });

  console.log('🚀 Branding synchronization complete.');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
