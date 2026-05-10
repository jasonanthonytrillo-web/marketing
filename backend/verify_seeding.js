const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
    if (!tenant) return console.log('No tenant');
    const products = await prisma.product.count({ where: { tenantId: tenant.id } });
    console.log(`Burger Palace Products: ${products}`);
  } finally {
    await prisma.$disconnect();
  }
}
main();
