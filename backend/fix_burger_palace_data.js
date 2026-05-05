const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixData() {
  console.log('🔄 Syncing Burger Palace Name & Branding (Raw SQL Mode)...');
  
  try {
    // Check if tenant exists
    const check = await prisma.$queryRaw`SELECT id FROM "Tenant" WHERE slug = 'burger-palace' LIMIT 1`;
    
    if (check.length > 0) {
      console.log('✅ Found existing tenant. Updating name and branding...');
      await prisma.$executeRaw`
        UPDATE "Tenant" 
        SET "name" = 'BURGER PALACE', 
            "primaryColor" = '#eab308', 
            "logo" = 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png', 
            "favicon" = 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png'
        WHERE "slug" = 'burger-palace';
      `;
    } else {
      console.log('➕ Creating new tenant "burger-palace"...');
      await prisma.$executeRaw`
        INSERT INTO "Tenant" ("name", "slug", "primaryColor", "logo", "favicon", "active", "updatedAt")
        VALUES ('BURGER PALACE', 'burger-palace', '#eab308', 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png', 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png', true, NOW());
      `;
    }

    console.log('✨ SUCCESS! BURGER PALACE DATA SYNCHRONIZED.');
    console.log('👉 Refresh your landing page now.');
  } catch (error) {
    console.error('❌ Raw Fix Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixData();
