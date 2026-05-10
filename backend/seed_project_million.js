const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Seeding Project Million with Premium Data...');
    
    // 1. Find the Tenant
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'project-million' } });
    if (!tenant) throw new Error('Project Million tenant not found. Run restore_master_admin.js first.');
    const tId = tenant.id;

    // 2. Clear existing (Optional - but safer for demo)
    // No, let's just add to it.

    // 3. Create Categories
    const categories = await Promise.all([
      prisma.category.create({ data: { name: 'Millionaire Burgers', tenantId: tId, icon: '🍔', sortOrder: 1 } }),
      prisma.category.create({ data: { name: 'Golden Sides', tenantId: tId, icon: '🍟', sortOrder: 2 } }),
      prisma.category.create({ data: { name: 'Signature Drinks', tenantId: tId, icon: '🥤', sortOrder: 3 } }),
    ]);

    const [catBurgers, catSides, catDrinks] = categories;

    // 4. Create Products
    await prisma.product.createMany({
      data: [
        {
          tenantId: tId,
          categoryId: catBurgers.id,
          name: 'The Millionaire Burger',
          description: 'Double Wagyu beef, truffle aioli, and 24k gold flakes (edible!).',
          price: 850,
          costPrice: 320,
          stock: 50,
          image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800',
          available: true
        },
        {
          tenantId: tId,
          categoryId: catBurgers.id,
          name: 'Imperial Cheeseburger',
          description: 'Aged cheddar, caramelized onions, and our secret "Success Sauce".',
          price: 450,
          costPrice: 150,
          stock: 100,
          image: 'https://images.unsplash.com/photo-1550317138-10000687ad32?auto=format&fit=crop&q=80&w=800',
          available: true
        },
        {
          tenantId: tId,
          categoryId: catSides.id,
          name: 'Truffle Gold Fries',
          description: 'Hand-cut potatoes tossed in white truffle oil and parmesan.',
          price: 250,
          costPrice: 60,
          stock: 200,
          image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=800',
          available: true
        },
        {
          tenantId: tId,
          categoryId: catDrinks.id,
          name: 'Artisanal Berry Soda',
          description: 'Freshly muddled berries with sparkling spring water.',
          price: 180,
          costPrice: 40,
          stock: 150,
          image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800',
          available: true
        }
      ]
    });

    console.log('✅ Seeding Complete! Project Million is now open for business.');
    
  } catch (e) {
    console.error('❌ Seeding failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
