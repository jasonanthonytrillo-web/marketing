const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Updating tenant logos and favicons...');

  // Update Burger Palace
  await prisma.tenant.update({
    where: { slug: 'burger-palace' },
    data: {
      logo: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&auto=format&fit=crop',
      favicon: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png' // Burger icon
    }
  });

  // Update Project Million / Elevate POS
  await prisma.tenant.update({
    where: { slug: 'project-million' },
    data: {
      logo: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=500&auto=format&fit=crop', // Diamond-like abstract
      favicon: 'https://cdn-icons-png.flaticon.com/512/10313/10313083.png' // Diamond icon
    }
  });

  console.log('✅ Tenant branding updated!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
