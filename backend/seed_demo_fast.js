const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('⚡️ Fast-Seeding 30 days of history for Burger Palace...');
    
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
    if (!tenant) return console.error('❌ Burger Palace not found.');

    const products = await prisma.product.findMany({ where: { tenantId: tenant.id } });
    if (products.length === 0) return console.error('❌ No products found.');

    // Clear existing orders
    await prisma.order.deleteMany({ where: { tenantId: tenant.id } });

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const isWeekend = date.getDay() === 0 || date.getDay() === 5 || date.getDay() === 6;
      const numOrders = isWeekend ? 35 : 20; // Fixed number for speed
      
      console.log(`📅 Day -${i}: Inserting ${numOrders} orders...`);
      
      for (let j = 0; j < numOrders; j++) {
        const orderDate = new Date(date);
        orderDate.setHours(12 + (j % 8), Math.floor(Math.random() * 60));
        
        const product = products[j % products.length];
        const qty = (j % 2) + 1;
        const total = product.price * qty;

        // Use a transaction-safe way or just create with items
        await prisma.order.create({
          data: {
            tenantId: tenant.id,
            orderNumber: `AI-DEMO-${i}-${j}`,
            status: 'completed',
            paymentStatus: 'paid',
            subtotal: total,
            total: total,
            createdAt: orderDate,
            items: {
              create: [{
                productId: product.id,
                productName: product.name,
                productPrice: product.price,
                quantity: qty,
                subtotal: total
              }]
            }
          }
        });
      }
    }

    console.log('✅ 30-Day History Restored! Try refreshing your Reports tab.');
  } catch (e) {
    console.error('❌ Fast seed failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
