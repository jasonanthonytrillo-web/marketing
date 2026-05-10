const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔑 Setting up Burger Palace Admin...');
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
    
    if (!tenant) {
      console.error('❌ Burger Palace Tenant not found! Run create_burger_tenant.js first.');
      return;
    }

    const hashedPassword = await bcrypt.hash('burgeradmin', 12);
    
    const admin = await prisma.user.upsert({
      where: { 
        email_tenantId: {
          email: 'admin@burgerpalace.com',
          tenantId: tenant.id
        }
      },
      update: {
        password: hashedPassword,
        active: true,
        role: 'admin'
      },
      create: {
        email: 'admin@burgerpalace.com',
        password: hashedPassword,
        name: 'Burger Palace Manager',
        role: 'admin',
        tenantId: tenant.id,
        active: true
      }
    });

    console.log(`✅ Admin account created: ${admin.email}`);
    console.log('🍔 You can now log in with:');
    console.log('   Email: admin@burgerpalace.com');
    console.log('   Password: burgeradmin');
  } catch (e) {
    console.error('❌ Failed to create admin:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
