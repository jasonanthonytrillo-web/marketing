const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repair() {
  // 1. Find Burger Palace
  const burgerPalace = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
  if (!burgerPalace) return console.log('Burger Palace tenant not found');

  // 2. Look for any category that might have been created recently
  // Since we don't have many categories, let's just make sure 
  // everything that isn't Project Million (ID 1) belongs to Burger Palace (ID 2)
  // OR just fix any categories that are currently empty.
  
  const categories = await prisma.category.findMany();
  console.log('Current Categories:', categories);

  // If there are categories that should be Burger Palace's but are marked as 1
  // (This might happen if the admin was logged into BP but the request defaulted to 1)
  // However, usually BP admin would create new ones.
  
  // Let's just create a category for them to be sure
  const newCat = await prisma.category.upsert({
    where: { id: 100 }, // Dummy ID for upsert
    update: {},
    create: {
      id: 100,
      tenantId: burgerPalace.id,
      name: 'Main Menu',
      description: 'Burger Palace Signature Items',
      icon: '🍔',
      active: true,
      sortOrder: 1
    }
  });
  console.log('Created/Verified Category for Burger Palace:', newCat);

  // 3. Move the Croissant to this new category
  await prisma.product.updateMany({
    where: { name: 'Croissant' },
    data: { categoryId: newCat.id, tenantId: burgerPalace.id }
  });
  console.log('Moved Croissant to Burger Palace category.');
}

repair().finally(() => prisma.$disconnect());
