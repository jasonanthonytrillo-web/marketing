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
    console.log(`🍟 Adding ${p.name}...`);
    try {
      // Use raw SQL to bypass the missing "isCombo" column issue
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Product" ("tenantId", "categoryId", "name", "description", "price", "stock", "available", "isCombo", "sortOrder", "image", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `, p.tenantId, p.categoryId, p.name, p.description, p.price, p.stock, true, false, 0, '');
    } catch (e) {
      // If that fails, try without the isCombo column entirely
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Product" ("tenantId", "categoryId", "name", "description", "price", "stock", "available", "sortOrder", "image", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, p.tenantId, p.categoryId, p.name, p.description, p.price, p.stock, true, 0, '');
    }
  }

  // Create Burger Palace Admin
  const bcrypt = require('bcryptjs');
  const adminPass = await bcrypt.hash('burgeradmin', 12);
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" ("email", "password", "name", "role", "active", "tenantId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT ("email") DO NOTHING
    `, 'admin@burgerpalace.com', adminPass, 'Burger Palace Manager', 'admin', true, tenant.id);
  } catch (e) {
    console.log('Admin already exists or error creating.');
  }

  console.log('✅ Burger Palace seeded successfully!');
  console.log('🍔 Login: admin@burgerpalace.com / burgeradmin');
}

seedBurgerPalace()
  .catch(e => { console.error('Seed failed:', e); })
  .finally(() => prisma.$disconnect());
