const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Starting Database Repair...');
    
    // Check if column exists first
    const cols = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'OrderItem' AND column_name = 'comboChoices'
    `;

    if (cols.length === 0) {
      console.log('📦 Adding missing column: comboChoices...');
      await prisma.$executeRawUnsafe('ALTER TABLE "OrderItem" ADD COLUMN "comboChoices" TEXT');
      console.log('✅ Column comboChoices added successfully!');
    } else {
      console.log('✨ Column comboChoices already exists!');
    }

    // Also check for isRedemption just in case
    const redCol = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'OrderItem' AND column_name = 'isRedemption'
    `;
    if (redCol.length === 0) {
      console.log('📦 Adding missing column: isRedemption...');
      await prisma.$executeRawUnsafe('ALTER TABLE "OrderItem" ADD COLUMN "isRedemption" BOOLEAN DEFAULT FALSE');
      console.log('✅ Column isRedemption added successfully!');
    }

    console.log('\n🎉 DATABASE REPAIRED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Repair Failed:', error.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
