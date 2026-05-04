const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  try {
    // === EDIT THESE DETAILS FOR YOUR NEW CLIENT ===
    const companyName = "Burger Palace";
    const companySlug = "burger-palace"; // They will visit burger-palace.your-pos.com
    const primaryColor = "#ef4444"; // Red
    const secondaryColor = "#fca5a5"; // Light Red
    
    const adminEmail = "admin@burgerpalace.com";
    const adminPassword = "password123";
    // ============================================

    console.log(`🚀 Creating new tenant: ${companyName}...`);

    // Fix the Postgres auto-increment sequence just in case it got stuck during migration
    await prisma.$executeRawUnsafe(`SELECT setval('"Tenant_id_seq"', (SELECT MAX(id) FROM "Tenant"));`);

    // 1. Create the Company (Tenant)
    const newTenant = await prisma.tenant.create({
      data: {
        name: companyName,
        slug: companySlug,
        primaryColor: primaryColor,
        secondaryColor: secondaryColor
      }
    });

    console.log(`✅ Tenant Created with ID: ${newTenant.id}`);

    // 2. Create the Admin User for this Company
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const newAdmin = await prisma.user.create({
      data: {
        tenantId: newTenant.id,
        name: "Store Manager",
        email: adminEmail,
        password: hashedPassword,
        role: "admin"
      }
    });

    console.log(`✅ Admin Account Created: ${newAdmin.email}`);
    console.log(`\n🎉 SUCCESS! You can now log into ${companySlug} using:`);
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);

  } catch (e) {
    console.error('❌ Error creating tenant:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
