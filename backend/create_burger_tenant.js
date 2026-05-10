const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🍔 Creating Burger Palace Tenant...');
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'burger-palace' },
      update: {
        primaryColor: '#e11d48',
        secondaryColor: '#f59e0b',
      },
      create: {
        name: 'Burger Palace',
        slug: 'burger-palace',
        primaryColor: '#e11d48',
        secondaryColor: '#f59e0b',
        active: true
      }
    });
    console.log('✅ Burger Palace Tenant Ready!');
  } catch (e) {
    console.error('❌ Failed to create tenant:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
