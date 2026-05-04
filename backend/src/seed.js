const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create default users
  const adminPass = await bcrypt.hash('admin123', 12);
  const cashierPass = await bcrypt.hash('cashier123', 12);
  const kitchenPass = await bcrypt.hash('kitchen123', 12);

  const usersToCreate = [
    { email: 'admin@pos.com', password: adminPass, name: 'Admin', role: 'admin' },
    { email: 'cashier@pos.com', password: cashierPass, name: 'Cashier 1', role: 'cashier' },
    { email: 'kitchen@pos.com', password: kitchenPass, name: 'Kitchen Staff', role: 'kitchen' }
  ];

  for (const u of usersToCreate) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) await prisma.user.create({ data: u });
  }

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Burgers', icon: '🍔', description: 'Juicy handcrafted burgers', sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Chicken', icon: '🍗', description: 'Crispy fried chicken', sortOrder: 2 } }),
    prisma.category.create({ data: { name: 'Rice Meals', icon: '🍚', description: 'Hearty rice meals', sortOrder: 3 } }),
    prisma.category.create({ data: { name: 'Beverages', icon: '🥤', description: 'Refreshing drinks', sortOrder: 4 } }),
    prisma.category.create({ data: { name: 'Milk Tea', icon: '🧋', description: 'Premium milk teas', sortOrder: 5 } }),
    prisma.category.create({ data: { name: 'Desserts', icon: '🍰', description: 'Sweet treats', sortOrder: 6 } }),
    prisma.category.create({ data: { name: 'Sides & Snacks', icon: '🍟', description: 'Perfect add-ons', sortOrder: 7 } }),
  ]);

  const [burgers, chicken, rice, beverages, milktea, desserts, sides] = categories;

  // Create products with add-ons
  const products = [
    { categoryId: burgers.id, name: 'Classic Burger', description: 'Beef patty with lettuce, tomato & special sauce', price: 89, stock: 50 },
    { categoryId: burgers.id, name: 'Cheese Burger', description: 'Classic burger with melted cheddar cheese', price: 109, stock: 50 },
    { categoryId: burgers.id, name: 'Double Patty Burger', description: 'Two juicy beef patties with all the fixings', price: 149, stock: 40 },
    { categoryId: burgers.id, name: 'Bacon Cheeseburger', description: 'Crispy bacon with cheddar on a beef patty', price: 139, stock: 40 },
    { categoryId: chicken.id, name: 'Fried Chicken (2pc)', description: 'Golden crispy fried chicken', price: 99, stock: 60 },
    { categoryId: chicken.id, name: 'Chicken Wings (6pc)', description: 'Spicy buffalo chicken wings', price: 149, stock: 40 },
    { categoryId: chicken.id, name: 'Chicken Tenders (4pc)', description: 'Breaded chicken strips with dip', price: 119, stock: 45 },
    { categoryId: rice.id, name: 'Pork Adobo', description: 'Filipino-style braised pork with rice', price: 129, stock: 35 },
    { categoryId: rice.id, name: 'Chicken Inasal', description: 'Grilled chicken marinated in citrus & annatto', price: 139, stock: 35 },
    { categoryId: rice.id, name: 'Tapsilog', description: 'Beef tapa with garlic rice & egg', price: 119, stock: 30 },
    { categoryId: rice.id, name: 'Sisig Rice Bowl', description: 'Sizzling pork sisig on steamed rice', price: 149, stock: 30 },
    { categoryId: beverages.id, name: 'Iced Tea', description: 'House blend iced tea', price: 39, stock: 100 },
    { categoryId: beverages.id, name: 'Coke / Sprite', description: 'Regular soda (12oz can)', price: 45, stock: 100 },
    { categoryId: beverages.id, name: 'Fresh Lemonade', description: 'Freshly squeezed lemonade', price: 55, stock: 80 },
    { categoryId: beverages.id, name: 'Hot Coffee', description: 'Freshly brewed Barako coffee', price: 65, stock: 80 },
    { categoryId: milktea.id, name: 'Classic Milk Tea', description: 'Traditional milk tea with pearls', price: 79, stock: 60 },
    { categoryId: milktea.id, name: 'Taro Milk Tea', description: 'Creamy taro flavored milk tea', price: 89, stock: 60 },
    { categoryId: milktea.id, name: 'Brown Sugar Milk Tea', description: 'Tiger sugar milk tea with boba', price: 99, stock: 50 },
    { categoryId: milktea.id, name: 'Matcha Milk Tea', description: 'Japanese matcha green tea latte', price: 99, stock: 50 },
    { categoryId: desserts.id, name: 'Halo-Halo', description: 'Classic Filipino shaved ice dessert', price: 89, stock: 40 },
    { categoryId: desserts.id, name: 'Leche Flan', description: 'Creamy caramel custard', price: 69, stock: 30 },
    { categoryId: desserts.id, name: 'Ube Ice Cream', description: 'Purple yam ice cream (2 scoops)', price: 59, stock: 50 },
    { categoryId: sides.id, name: 'French Fries', description: 'Crispy golden fries with ketchup', price: 65, stock: 70 },
    { categoryId: sides.id, name: 'Onion Rings', description: 'Beer-battered onion rings', price: 75, stock: 50 },
    { categoryId: sides.id, name: 'Coleslaw', description: 'Creamy homemade coleslaw', price: 45, stock: 60 },
    { categoryId: sides.id, name: 'Mozzarella Sticks', description: 'Fried mozzarella with marinara', price: 89, stock: 40 },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  // Add some addons to milk tea products
  const milkTeaProducts = await prisma.product.findMany({ where: { categoryId: milktea.id } });
  for (const mt of milkTeaProducts) {
    await prisma.productAddon.createMany({
      data: [
        { productId: mt.id, name: 'Extra Pearls', price: 15 },
        { productId: mt.id, name: 'Nata de Coco', price: 15 },
        { productId: mt.id, name: 'Pudding', price: 20 },
        { productId: mt.id, name: 'Cream Cheese Foam', price: 25 },
      ]
    });
  }

  // Add addons to burgers
  const burgerProducts = await prisma.product.findMany({ where: { categoryId: burgers.id } });
  for (const b of burgerProducts) {
    await prisma.productAddon.createMany({
      data: [
        { productId: b.id, name: 'Extra Patty', price: 40 },
        { productId: b.id, name: 'Extra Cheese', price: 20 },
        { productId: b.id, name: 'Bacon', price: 30 },
        { productId: b.id, name: 'Egg', price: 15 },
      ]
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log('📋 Default accounts:');
  console.log('   Admin:   admin@pos.com / admin123');
  console.log('   Cashier: cashier@pos.com / cashier123');
  console.log('   Kitchen: kitchen@pos.com / kitchen123');
}

seed()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
