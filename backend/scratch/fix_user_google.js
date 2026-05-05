const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('🚀 Starting User Table Repair...');
  try {
    // Check if column exists
    const cols = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name = 'isGoogle'
    `;

    if (cols.length === 0) {
      console.log('📦 Adding missing column: isGoogle to User table...');
      await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "isGoogle" BOOLEAN DEFAULT FALSE');
      console.log('✅ Column isGoogle added successfully!');
    } else {
      console.log('✨ Column isGoogle already exists!');
    }

    console.log('\n🎉 DATABASE REPAIRED SUCCESSFULLY!');
  } catch (e) {
    console.error('❌ Repair Failed:', e.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

fix();
