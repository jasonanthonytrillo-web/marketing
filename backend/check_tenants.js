const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tenants = await prisma.tenant.findMany();
  console.log("Tenants found:", tenants.length);
  tenants.forEach(t => {
    console.log(`- ${t.name} (${t.slug})`);
    console.log(`  Logo: ${t.logo}`);
    console.log(`  Favicon: ${t.favicon}`);
    console.log(`  Banner: ${t.bannerImage}`);
    console.log(`  Colors: ${t.primaryColor} / ${t.secondaryColor}`);
    console.log('---');
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
