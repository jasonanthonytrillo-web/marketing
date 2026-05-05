const prisma = require('./src/lib/prisma');

async function seedBurgerPalace() {
  console.log('🍔 Seeding Burger Palace...');

  // Find Burger Palace Tenant
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
  
  if (!tenant) {
    console.error('❌ Burger Palace tenant not found! Run fix_tenant_data.js first.');
    return;
  }

  // Create Categories for Burger Palace
  const categories = await Promise.all([
    prisma.category.create({ data: { tenantId: tenant.id, name: 'Signature Burgers', icon: '🍔', sortOrder: 1 } }),
    prisma.category.create({ data: { tenantId: tenant.id, name: 'Value Meals', icon: '🍟', sortOrder: 2 } }),
    prisma.category.create({ data: { tenantId: tenant.id, name: 'Drinks', icon: '🥤', sortOrder: 3 } })
  ]);

  const [burgers, meals, drinks] = categories;

  // Create Products for Burger Palace
  const products = [
    { tenantId: tenant.id, categoryId: burgers.id, name: 'The Royal King Burger', description: 'Triple patty with royal cheese and secret sauce', price: 299, stock: 50 },
    { tenantId: tenant.id, categoryId: burgers.id, name: 'Spicy Queen Chicken', description: 'Crispy spicy chicken sandwich', price: 199, stock: 50 },
    { tenantId: tenant.id, categoryId: meals.id, name: 'King Meal (Fries & Drink)', description: 'Add large fries and large drink', price: 150, stock: 100 },
    { tenantId: tenant.id, categoryId: drinks.id, name: 'Palace Lemonade', description: 'Fresh squeezed royal lemonade', price: 89, stock: 100 },
    { tenantId: tenant.id, categoryId: drinks.id, name: 'Cola', description: 'Chilled cola', price: 50, stock: 100 },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  // Create Burger Palace Admin
  const bcrypt = require('bcryptjs');
  const adminPass = await bcrypt.hash('burgeradmin', 12);
  const exists = await prisma.user.findUnique({ where: { email: 'admin@burgerpalace.com' } });
  if (!exists) {
    await prisma.user.create({
      data: {
        email: 'admin@burgerpalace.com',
        password: adminPass,
        name: 'Burger Palace Manager',
        role: 'admin',
        tenantId: tenant.id
      }
    });
  }

  console.log('✅ Burger Palace seeded successfully!');
  console.log('🍔 Login: admin@burgerpalace.com / burgeradmin');
}

seedBurgerPalace()
  .catch(e => { console.error('Seed failed:', e); })
  .finally(() => prisma.$disconnect());
