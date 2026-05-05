const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  console.log('👑 Creating Global SuperAdmin account...');
  
  try {
    const password = await bcrypt.hash('superadmin123', 12);
    
    const user = await prisma.user.upsert({
      where: { email: 'superadmin@elevatepos.com' },
      update: {
        role: 'superadmin',
        active: true
      },
      create: {
        email: 'superadmin@elevatepos.com',
        password: password,
        name: 'Master SuperAdmin',
        role: 'superadmin',
        active: true
      }
    });

    console.log('✅ SUPERADMIN CREATED SUCCESSFULLY!');
    console.log('📧 Email: superadmin@elevatepos.com');
    console.log('🔑 Password: superadmin123');
    console.log('🌐 Dashboard: /superadmin');
  } catch (error) {
    console.error('❌ Failed to create SuperAdmin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
