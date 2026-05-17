const prisma = require('./src/lib/prisma');

async function check() {
  console.log('=== SYSTEM STATUS REPORT ===\n');

  // Tenants
  const tenants = await prisma.tenant.findMany();
  console.log('--- tenants ---');
  console.log(JSON.stringify(tenants.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    active: t.active
  })), null, 2));

  // Users & Superadmins
  const users = await prisma.user.findMany({
    include: { tenant: true }
  });
  console.log('\n--- users & roles ---');
  console.log(JSON.stringify(users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    tenantId: u.tenantId,
    tenantName: u.tenant ? u.tenant.name : 'NONE'
  })), null, 2));

  // Counts
  const productCount = await prisma.product.count();
  const categoryCount = await prisma.category.count();
  const orderCount = await prisma.order.count();
  const auditLogCount = await prisma.auditLog.count();
  
  console.log('\n--- entity counts ---');
  console.log(`- Categories: ${categoryCount}`);
  console.log(`- Products:   ${productCount}`);
  console.log(`- Orders:     ${orderCount}`);
  console.log(`- Audit Logs: ${auditLogCount}`);
  
  console.log('\n=== END REPORT ===');
}

check().catch(console.error).finally(() => prisma.$disconnect());
