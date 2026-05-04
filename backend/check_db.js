const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants:', tenants.map(t => ({ id: t.id, name: t.name, slug: t.slug })));

  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } }
  });
  console.log('\nCategories:', categories.map(c => ({ id: c.id, name: c.name, tenantId: c.tenantId, productCount: c._count.products })));

  const products = await prisma.product.findMany();
  console.log('\nProducts:', products.map(p => ({ id: p.id, name: p.name, tenantId: p.tenantId, categoryId: p.categoryId })));
}

check().finally(() => prisma.$disconnect());
