const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = 5; // Hometown Brew

  console.log('🌱 Seeding Hometown Brew (ID: 5)...');

  // 1. Create Categories
  const categories = [
    { name: 'Coffee Classics', icon: '☕', description: 'Freshly brewed espresso-based drinks' },
    { name: 'Iced Specialties', icon: '🧊', description: 'Refreshing cold coffee and more' },
    { name: 'Bakery & Pastries', icon: '🥐', description: 'Handcrafted daily baked goods' },
    { name: 'Sandwiches & Savory', icon: '🥪', description: 'Hot and delicious bites' }
  ];

  for (const catData of categories) {
    const category = await prisma.category.upsert({
      where: { id: -1 }, // Dummy where for creation
      update: {},
      create: {
        tenantId,
        ...catData,
        active: true
      }
    });

    console.log(`✅ Category Created: ${category.name}`);

    // 2. Create Products based on category
    let products = [];
    if (catData.name === 'Coffee Classics') {
      products = [
        { name: 'Espresso', price: 85, description: 'Pure, concentrated coffee shot', stock: 999 },
        { name: 'Americano', price: 120, description: 'Espresso with hot water', stock: 999 },
        { name: 'Cafe Latte', price: 145, description: 'Espresso with steamed milk and thin foam', stock: 999 },
        { name: 'Cappuccino', price: 145, description: 'Espresso with balanced steamed milk and foam', stock: 999 },
        { name: 'Caramel Macchiato', price: 165, description: 'Vanilla-flavored milk marked with espresso and caramel', stock: 999 }
      ];
    } else if (catData.name === 'Iced Specialties') {
      products = [
        { name: 'Iced Americano', price: 130, description: 'Espresso over ice', stock: 999 },
        { name: 'Iced Cafe Latte', price: 155, description: 'Chilled espresso and milk over ice', stock: 999 },
        { name: 'Cold Brew', price: 140, description: 'Slow-steeped for 18 hours for maximum smoothness', stock: 999 },
        { name: 'Matcha Latte', price: 170, description: 'Ceremonial grade matcha with creamy milk', stock: 999 }
      ];
    } else if (catData.name === 'Bakery & Pastries') {
      products = [
        { name: 'Butter Croissant', price: 95, description: 'Flaky, buttery French classic', stock: 24 },
        { name: 'Pain au Chocolat', price: 110, description: 'Croissant dough with dark chocolate batons', stock: 20 },
        { name: 'Blueberry Muffin', price: 85, description: 'Soft muffin bursting with fresh blueberries', stock: 15 },
        { name: 'Chocolate Chip Cookie', price: 65, description: 'Chewy cookie with premium chocolate chunks', stock: 30 }
      ];
    } else if (catData.name === 'Sandwiches & Savory') {
      products = [
        { name: 'Ham & Cheese Croissant', price: 185, description: 'Savory ham and melted emmental in a croissant', stock: 12 },
        { name: 'Tuna Melt', price: 195, description: 'Warm tuna salad with melted cheddar on sourdough', stock: 10 },
        { name: 'Chicken Pesto Sandwich', price: 210, description: 'Grilled chicken with basil pesto and mozzarella', stock: 8 }
      ];
    }

    for (const prodData of products) {
      await prisma.product.create({
        data: {
          tenantId,
          categoryId: category.id,
          ...prodData,
          available: true
        }
      });
      console.log(`   🔸 Product Added: ${prodData.name}`);
    }
  }

  console.log('✨ Hometown Brew Seeding Finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
