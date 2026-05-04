const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setRewardCosts() {
  try {
    // Update some products to have point costs
    await prisma.product.updateMany({
      where: { name: { contains: 'Classic Burger' } },
      data: { pointsCost: 50 }
    });
    
    await prisma.product.updateMany({
      where: { name: { contains: 'Double Patty' } },
      data: { pointsCost: 100 }
    });
    
    await prisma.product.updateMany({
      where: { name: { contains: 'Fries' } },
      data: { pointsCost: 30 }
    });

    console.log('✅ Reward costs successfully added to the menu!');
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

setRewardCosts();
