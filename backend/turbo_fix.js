const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('⚡ Starting Turbo Fix...');
  try {
    // Add the column directly via Raw SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "estimatedPrepTime" INTEGER;
    `);
    console.log('✅ Column "estimatedPrepTime" added successfully!');
  } catch (e) {
    console.log('⚠️ Column might already exist or error occurred:', e.message);
  } finally {
    await prisma.$disconnect();
    console.log('🏁 Turbo Fix Complete.');
  }
}

main();
