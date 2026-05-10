const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
    const count = await prisma.order.count({ where: { tenantId: tenant.id, status: 'completed' } });
    console.log('Total completed orders for Burger Palace:', count);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = await prisma.order.findMany({
      where: { tenantId: tenant.id, status: 'completed', createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true }
    });
    
    console.log('Orders in last 30 days:', recentOrders.length);
    
    const dayMap = {};
    recentOrders.forEach(o => {
      const day = o.createdAt.toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    console.log('Days with orders:', Object.keys(dayMap).length);
    console.log('Dates found:', Object.keys(dayMap).sort());
  } finally {
    await prisma.$disconnect();
  }
}
debug();
