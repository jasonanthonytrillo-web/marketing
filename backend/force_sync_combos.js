// 1. FORCE THE CONNECTION AT THE SYSTEM LEVEL
// This overrides any broken terminal settings
process.env.DATABASE_URL = "postgresql://postgres.gtpisifdmptxcbfwvfxv:nichellepaswwor@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
process.env.DIRECT_URL = "postgresql://postgres.gtpisifdmptxcbfwvfxv:nichellepaswwor@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceSync() {
  console.log('🚀 Starting SELF-CORRECTING Force Sync...');
  console.log('🔗 Connecting to: ' + process.env.DATABASE_URL.split('@')[1]);
  
  try {
    // 1. Add isCombo column
    console.log('📦 Adding "isCombo" column...');
    await prisma.$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isCombo" BOOLEAN DEFAULT false');
    
    // 2. Add comboGroup1Name column
    console.log('📦 Adding "comboGroup1Name" column...');
    await prisma.$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "comboGroup1Name" TEXT');
    
    // 3. Add comboGroup2Name column
    console.log('📦 Adding "comboGroup2Name" column...');
    await prisma.$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "comboGroup2Name" TEXT');

    // 4. Create ComboOption table if it doesn't exist
    console.log('📦 Creating "ComboOption" table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ComboOption" (
        "id" SERIAL PRIMARY KEY,
        "tenantId" INTEGER NOT NULL,
        "comboId" INTEGER NOT NULL,
        "productId" INTEGER NOT NULL,
        "groupNumber" INTEGER NOT NULL DEFAULT 1,
        "priceBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ FORCE SYNC COMPLETE! Your database is now ready.');
  } catch (error) {
    console.error('❌ Force Sync Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

forceSync();
