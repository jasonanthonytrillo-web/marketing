const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log('=== DATABASE TENANTS ===');
  console.log(JSON.stringify(tenants, null, 2));
}

main().finally(() => prisma.$disconnect());
