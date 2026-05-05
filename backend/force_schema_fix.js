const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceFix() {
  console.log('⚡ Force-syncing Database Schema...');
  
  try {
    // Manually add the missing column using raw SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "bannerAssets" JSONB;
    `);

    console.log('✅ Column bannerAssets added successfully!');
    
    // Now run the repair script logic directly
    console.log('🍔 Updating Burger Palace branding...');
    await prisma.$executeRawUnsafe(`
      UPDATE "Tenant" 
      SET name = 'BURGER PALACE', 
          "primaryColor" = '#eab308', 
          active = true,
          "updatedAt" = NOW()
      WHERE slug = 'burger-palace';
    `);

    console.log('🎉 ALL FIXED! Please refresh your browser.');
  } catch (error) {
    console.error('❌ Force Fix Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

forceFix();
