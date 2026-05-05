const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  console.log('👑 Creating Global SuperAdmin account...');
  
  try {
    const password = await bcrypt.hash('superadmin123', 12);
    
    // Check if superadmin exists (where tenantId is null)
    let user = await prisma.user.findFirst({
      where: { email: 'superadmin@elevatepos.com', role: 'superadmin' }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { active: true }
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: 'superadmin@elevatepos.com',
          password: password,
          name: 'Master SuperAdmin',
          role: 'superadmin',
          active: true,
          tenantId: null
        }
      });
    }

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
