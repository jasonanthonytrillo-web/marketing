const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceFix() {
  console.log('⚡ Starting Manual Schema Sync...');
  
  try {
    // 1. Add logo column
    console.log('➕ Adding "logo" column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logo" TEXT;`);
    
    // 2. Add favicon column
    console.log('➕ Adding "favicon" column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "favicon" TEXT;`);
    
    // 3. Add bannerImage column
    console.log('➕ Adding "bannerImage" column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "bannerImage" TEXT;`);
    
    console.log('✅ DATABASE SCHEMA UPDATED SUCCESSFULLY!');
    console.log('🚀 You can now try logging in again.');
  } catch (error) {
    console.error('❌ Manual Sync Failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️ Columns already exist, which is fine.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

forceFix();
