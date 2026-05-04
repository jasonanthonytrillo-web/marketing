const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Starting Multi-Tenant Initialization...');

    // 1. Create the first tenant
    const firstTenant = await prisma.tenant.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: 'PROJECT MILLION',
        slug: 'project-million',
        primaryColor: '#f97316',
        secondaryColor: '#fbbf24'
      }
    });

    console.log(`✅ Tenant "${firstTenant.name}" created/verified.`);

    // 2. Link all existing data to this tenant
    console.log('🔗 Linking existing data to Tenant #1...');
    
    await prisma.user.updateMany({ data: { tenantId: 1 } });
    await prisma.category.updateMany({ data: { tenantId: 1 } });
    await prisma.product.updateMany({ data: { tenantId: 1 } });
    await prisma.order.updateMany({ data: { tenantId: 1 } });
    await prisma.systemSetting.updateMany({ data: { tenantId: 1 } });

    console.log('🎉 All existing data has been moved to your first company!');
  } catch (e) {
    console.error('❌ Initialization failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
