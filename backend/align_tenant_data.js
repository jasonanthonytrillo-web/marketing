// 1. FORCE THE CONNECTION AT THE SYSTEM LEVEL
process.env.DATABASE_URL = "postgresql://postgres.gtpisifdmptxcbfwvfxv:nichellepaswwor@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
process.env.DIRECT_URL = "postgresql://postgres.gtpisifdmptxcbfwvfxv:nichellepaswwor@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function alignTenantData() {
  console.log('🛠️ Aligning Tenant IDs for Burger Palace...');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-palace' } });
  if (!tenant) return console.error('Tenant not found');

  console.log(`🏠 Burger Palace Tenant ID is: ${tenant.id}`);

  // Update all categories that look like they belong to Burger Palace
  await prisma.category.updateMany({
    where: { 
      OR: [
        { name: 'Signature Burgers' },
        { name: 'Value Meals' },
        { name: 'Drinks' }
      ]
    },
    data: { tenantId: tenant.id, active: true }
  });

  // Get those category IDs
  const categories = await prisma.category.findMany({ where: { tenantId: tenant.id } });
  
  // Update all products to match the tenant and categories
  const products = await prisma.product.findMany(); // Get all to be sure
  for (const p of products) {
    if (p.name.includes('Palace') || p.name.includes('King') || p.name.includes('Queen') || p.name.includes('Mix')) {
      let catId = p.categoryId;
      if (p.name.includes('Burger') || p.name.includes('Chicken')) catId = categories.find(c => c.name === 'Signature Burgers')?.id;
      if (p.name.includes('Mix') || p.name.includes('Meal')) catId = categories.find(c => c.name === 'Value Meals')?.id;
      if (p.name.includes('Lemonade') || p.name.includes('Cola')) catId = categories.find(c => c.name === 'Drinks')?.id;

      await prisma.product.update({
        where: { id: p.id },
        data: { tenantId: tenant.id, categoryId: catId, available: true }
      });
      console.log(`✅ Fixed Product: ${p.name} -> Tenant ${tenant.id}, Category ${catId}`);
    }
  }

  console.log('✅ ALIGNMENT COMPLETE!');
}

alignTenantData()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
