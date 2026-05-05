const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairBurgerPalace() {
  console.log('🍔 Repairing Burger Palace Identity...');
  
  try {
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'burger-palace' },
      update: {
        name: 'BURGER PALACE',
        primaryColor: '#eab308', // Gold
        logo: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        favicon: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        active: true
      },
      create: {
        name: 'BURGER PALACE',
        slug: 'burger-palace',
        primaryColor: '#eab308',
        logo: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        favicon: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        active: true
      }
    });

    console.log('✅ REPAIR COMPLETE!');
    console.log('🏪 Shop Name:', tenant.name);
    console.log('🔗 URL Slug:', tenant.slug);
    console.log('✨ You should now see BURGER PALACE on the landing page.');
  } catch (error) {
    console.error('❌ Repair Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

repairBurgerPalace();
