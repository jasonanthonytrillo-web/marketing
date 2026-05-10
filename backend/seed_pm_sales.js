const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('💰 Seeding Project Million with Sales Activity...');
    
    // 1. Find Tenant and Products
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
    if (!tenant) throw new Error('Project Million tenant not found.');
    
    const products = await prisma.product.findMany({ where: { tenantId: tenant.id } });
    if (products.length === 0) throw new Error('No products found. Run seed_project_million.js first.');

    const tId = tenant.id;

    // 2. Create some demo orders for TODAY
    for (let i = 0; i < 15; i++) {
      const randomProd = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const subtotal = randomProd.price * qty;

      await prisma.order.create({
        data: {
          tenantId: tId,
          orderNumber: `PM-DEMO-${Date.now()}-${i}`,
          customerName: 'Demo VIP Customer',
          orderType: i % 2 === 0 ? 'dine_in' : 'take_out',
          status: 'completed',
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          subtotal: subtotal,
          total: subtotal,
          items: {
            create: {
              productId: randomProd.id,
              productName: randomProd.name,
              productPrice: randomProd.price, // FIXED FIELD NAME
              quantity: qty,
              subtotal: subtotal
            }
          }
        }
      });
    }

    // 3. Create some Expenses
    await prisma.expense.createMany({
      data: [
        { tenantId: tId, name: 'Premium Wagyu Beef Supply', amount: 4500, category: 'supplies', date: new Date() },
        { tenantId: tId, name: 'Shop Rent (Pro-rated)', amount: 1200, category: 'rent', date: new Date() }
      ]
    });

    console.log('✅ Sales Seeding Complete! Refresh your Overview tab.');
    
  } catch (e) {
    console.error('❌ Sales seeding failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
