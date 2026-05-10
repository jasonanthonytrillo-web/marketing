const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Restoring Project Million Master Tenant...');
    
    // 1. Create or Update Master Tenant
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'project-million' },
      update: {
        primaryColor: '#f97316', // Orange
        secondaryColor: '#fbbf24',
      },
      create: {
        name: 'Project Million',
        slug: 'project-million',
        primaryColor: '#f97316',
        secondaryColor: '#fbbf24',
        active: true
      }
    });
    console.log('✅ Master Tenant Ready (ID: ' + tenant.id + ')');

    // 2. Create Master Admin
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const adminEmail = 'admin@pos.com';
    
    const admin = await prisma.user.upsert({
      where: { 
        email_tenantId: { 
          email: adminEmail, 
          tenantId: tenant.id 
        } 
      },
      update: {
        password: hashedPassword,
        role: 'admin',
        active: true
      },
      create: {
        email: adminEmail,
        name: 'Project Million Admin',
        password: hashedPassword,
        role: 'admin',
        tenantId: tenant.id,
        active: true
      }
    });
    console.log('✅ Master Admin Ready: admin@pos.com / admin123');
    
  } catch (e) {
    console.error('❌ Restore failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
