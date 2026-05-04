const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrders() {
  try {
    const lastOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        orderNumber: true,
        customerId: true,
        customerName: true,
        total: true,
        status: true
      }
    });
    
    console.log('--- RECENT ORDERS DIAGNOSTIC ---');
    console.table(lastOrders);
    
    const user = await prisma.user.findFirst({
      where: { email: 'jason@gmail.com' }
    });
    
    if (user) {
      console.log(`\n--- USER STATE: ${user.email} ---`);
      console.log(`ID: ${user.id}`);
      console.log(`Points in DB: ${user.points}`);
    } else {
      console.log('\nUser jason@gmail.com not found!');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();
