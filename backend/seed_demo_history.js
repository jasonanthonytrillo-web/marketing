const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('⏳ Generating 30 days of simulated history for Burger Palace...');
    
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
    if (!tenant) return console.error('❌ Burger Palace not found.');

    const products = await prisma.product.findMany({ where: { tenantId: tenant.id } });
    if (products.length === 0) return console.error('❌ No products found to create orders.');

    // Clear existing orders to avoid messy data
    await prisma.order.deleteMany({ where: { tenantId: tenant.id } });

    const ordersToCreate = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const isWeekend = date.getDay() === 0 || date.getDay() === 5 || date.getDay() === 6;
      
      // Generate 15-25 orders per weekday, 30-50 per weekend
      const numOrders = isWeekend ? Math.floor(Math.random() * 20) + 30 : Math.floor(Math.random() * 10) + 15;
      
      for (let j = 0; j < numOrders; j++) {
        // Random time during the day (10 AM to 10 PM)
        const orderDate = new Date(date);
        orderDate.setHours(Math.floor(Math.random() * 12) + 10, Math.floor(Math.random() * 60));
        
        // Pick 1-3 random products
        const numItems = Math.floor(Math.random() * 3) + 1;
        let subtotal = 0;
        const items = [];
        
        for (let k = 0; k < numItems; k++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const qty = Math.floor(Math.random() * 2) + 1;
          const itemSub = product.price * qty;
          subtotal += itemSub;
          items.push({
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            quantity: qty,
            subtotal: itemSub
          });
        }

        const orderNumber = `DEMO-${i}-${j}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        
        ordersToCreate.push({
          tenantId: tenant.id,
          orderNumber,
          customerName: 'Demo Customer',
          orderType: Math.random() > 0.5 ? 'dine_in' : 'take_out',
          status: 'completed',
          paymentStatus: 'paid',
          subtotal,
          total: subtotal,
          createdAt: orderDate,
          updatedAt: orderDate,
          items: { create: items }
        });
      }
      console.log(`📅 Day -${i}: Generated ${numOrders} orders.`);
    }

    // Create orders one by one to avoid large transaction issues
    for (const orderData of ordersToCreate) {
      await prisma.order.create({ data: orderData });
    }

    console.log('✅ 30-Day History Successfully Seeded!');
    console.log('🔮 The AI Forecasting should now show High Confidence data.');
  } catch (e) {
    console.error('❌ Seeding failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
