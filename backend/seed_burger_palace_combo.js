// 1. FORCE THE CONNECTION AT THE SYSTEM LEVEL
process.env.DATABASE_URL = "postgresql://postgres.gtpisifdmptxcbfwvfxv:nichellepaswwor@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
process.env.DIRECT_URL = "postgresql://postgres.gtpisifdmptxcbfwvfxv:nichellepaswwor@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedBurgerPalaceCombos() {
  console.log('🍔 Seeding 5 Palace Mix & Match Combos...');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
  if (!tenant) return console.error('Tenant not found');

  const categories = await prisma.category.findMany({ where: { tenantId: tenant.id } });
  const burgerCat = categories.find(c => c.name === 'Signature Burgers');
  const mealCat = categories.find(c => c.name === 'Value Meals');
  const drinkCat = categories.find(c => c.name === 'Drinks');

  const burgers = await prisma.product.findMany({ where: { categoryId: burgerCat.id } });
  const drinks = await prisma.product.findMany({ where: { categoryId: drinkCat.id } });

  const comboTemplates = [
    { name: '👑 Palace Mix A (Budget)', price: 149, desc: 'A quick and tasty snack combo!' },
    { name: '👑 Palace Mix B (Classic)', price: 199, desc: 'The original Palace favorite.' },
    { name: '👑 Palace Mix C (Deluxe)', price: 249, desc: 'Our most popular value meal!' },
    { name: '👑 Palace Mix D (Royal)', price: 299, desc: 'A feast fit for a King or Queen.' },
    { name: '👑 Palace Mix E (Ultimate)', price: 349, desc: 'Everything you want in one meal.' }
  ];

  for (let i = 0; i < comboTemplates.length; i++) {
    const t = comboTemplates[i];
    console.log(`📦 Creating ${t.name}...`);
    
    const combo = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: mealCat.id,
        name: t.name,
        description: t.desc,
        price: t.price,
        image: `https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=1000&auto=format&fit=crop&sig=${i}`,
        isCombo: true,
        comboGroup1Name: 'Select Main Course',
        comboGroup2Name: 'Select Side or Drink',
        available: true,
        stock: 999
      }
    });

    // Link options
    for (const b of burgers) {
      await prisma.comboOption.create({
        data: { tenantId: tenant.id, comboId: combo.id, productId: b.id, groupNumber: 1 }
      });
    }
    for (const d of drinks) {
      await prisma.comboOption.create({
        data: { tenantId: tenant.id, comboId: combo.id, productId: d.id, groupNumber: 2 }
      });
    }
  }

  console.log('✅ ALL 5 COMBOS READY! Refresh your Menu.');
}

seedBurgerPalaceCombos()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
