const prisma = require('./src/lib/prisma');

async function check() {
  const categories = await prisma.category.findMany();
  console.log("Categories:", categories);

  const products = await prisma.product.findMany();
  console.log("Products:", products);
}

check().catch(console.error).finally(() => prisma.$disconnect());
