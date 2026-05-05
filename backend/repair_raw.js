const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairRaw() {
  console.log('🍔 Repairing Burger Palace via Raw SQL...');
  
  try {
    // This bypasses the Prisma Client validation
    await prisma.$executeRaw`
      INSERT INTO "Tenant" (name, slug, "primaryColor", "active", "updatedAt")
      VALUES ('BURGER PALACE', 'burger-palace', '#eab308', true, NOW())
      ON CONFLICT (slug) DO UPDATE 
      SET name = 'BURGER PALACE', "primaryColor" = '#eab308', "active" = true, "updatedAt" = NOW();
    `;

    console.log('✅ RAW REPAIR COMPLETE!');
    console.log('✨ You should now see BURGER PALACE branding.');
  } catch (error) {
    console.error('❌ Raw Repair Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

repairRaw();
