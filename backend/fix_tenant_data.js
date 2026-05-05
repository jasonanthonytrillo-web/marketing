const prisma = require('./src/lib/prisma');

async function fixData() {
  console.log("Fixing orphaned data...");
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'project-million' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Project Million', slug: 'project-million', primaryColor: '#f97316', secondaryColor: '#fbbf24' }
    });
    console.log("Created Tenant:", tenant.name);
  }

  // Update Users
  await prisma.user.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  console.log("Users updated.");

  // Update Categories
  await prisma.category.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  console.log("Categories updated.");

  // Update Products
  await prisma.product.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
  console.log("Products updated.");

  // Wait, does burger-palace exist?
  let burger = await prisma.tenant.findFirst({ where: { slug: 'burger-palace' } });
  if (!burger) {
    burger = await prisma.tenant.create({
      data: { name: 'Burger Palace', slug: 'burger-palace', primaryColor: '#b91c1c', secondaryColor: '#ea580c' }
    });
    console.log("Created Tenant:", burger.name);
  }

  console.log("✅ Fix complete.");
}

fixData().catch(console.error).finally(() => prisma.$disconnect());
