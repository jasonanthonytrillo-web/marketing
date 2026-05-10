const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🎨 Restoring Burger Palace Branding...');
    const tenant = await prisma.tenant.update({
      where: { slug: 'burger-palace' },
      data: {
        primaryColor: '#e11d48', // Deep Red
        secondaryColor: '#f59e0b', // Amber/Yellow
        bannerImage: '/uploads/burger-palace-bg.png',
        active: true
      }
    });
    console.log(`✅ Branding restored for "${tenant.name}"!`);
  } catch (e) {
    console.error('❌ Failed to restore branding:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
