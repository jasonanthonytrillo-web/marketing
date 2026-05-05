const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceMultiStore() {
  console.log('⚡ Force-syncing Multi-Store Account Schema...');
  
  try {
    // 1. Remove the global unique constraint on email
    console.log('🔓 Removing global email restriction...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
    `);

    // 2. Add the composite unique constraint for [email, tenantId]
    console.log('🔐 Adding store-specific account security...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD CONSTRAINT "User_email_tenantId_key" UNIQUE ("email", "tenantId");
    `);

    console.log('✅ MULTI-STORE ACCOUNTS ENABLED!');
    console.log('🎉 Customers can now use the same email across all your shops.');
  } catch (error) {
    console.error('❌ Force Update Failed:', error.message);
    console.log('💡 Note: This might fail if you already have duplicate emails in your database. Clean them up first if so!');
  } finally {
    await prisma.$disconnect();
  }
}

forceMultiStore();
