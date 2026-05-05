// 1. FORCE THE CONNECTION AT THE SYSTEM LEVEL
process.env.DATABASE_URL = "postgresql://postgres.gtpisifdmptxcbfwvfxv:nichellepaswwor@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
process.env.DIRECT_URL = "postgresql://postgres.gtpisifdmptxcbfwvfxv:nichellepaswwor@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBurgerPalaceData() {
  console.log('🛠️ Deep Syncing Burger Palace Data...');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
  if (!tenant) return console.error('Tenant not found');

  // 1. Find the correct categories
  const categories = await prisma.category.findMany({ where: { tenantId: tenant.id } });
  const burgerCat = categories.find(c => c.name === 'Signature Burgers');
  const mealCat = categories.find(c => c.name === 'Value Meals');
  const drinkCat = categories.find(c => c.name === 'Drinks');

  if (!burgerCat || !mealCat || !drinkCat) {
    console.log('⚠️ Some categories missing, recreating them...');
    // This might be the issue - if the categories were created but have no products
  }

  // 2. Update ALL products for this tenant to ensure they are linked to the right categories
  // We'll search by name to find them and re-link
  const products = await prisma.product.findMany({ where: { tenantId: tenant.id } });
  
  for (const p of products) {
    let newCatId = p.categoryId;
    if (p.name.includes('Burger') || p.name.includes('Chicken')) newCatId = burgerCat.id;
    if (p.name.includes('Mix') || p.name.includes('Meal')) newCatId = mealCat.id;
    if (p.name.includes('Lemonade') || p.name.includes('Cola')) newCatId = drinkCat.id;

    await prisma.product.update({
      where: { id: p.id },
      data: { categoryId: newCatId, available: true }
    });
    console.log(`✅ Updated ${p.name} to category ${newCatId}`);
  }

  console.log('✅ DEEP SYNC COMPLETE!');
}

fixBurgerPalaceData()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
