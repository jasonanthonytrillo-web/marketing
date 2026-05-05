const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyLogos() {
  console.log('🎨 Applying New Professional Branding...');
  
  try {
    // 1. Update Project Million (Default/Root Identity)
    // We update the system settings or just a generic placeholder if needed
    // But usually Project Million is the "fallback"
    
    // 2. Update Burger Palace
    await prisma.tenant.update({
      where: { slug: 'burger-palace' },
      data: {
        logo: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=500&auto=format&fit=crop', // Temporary high-quality placeholder until you upload the generated ones
        favicon: 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png',
        primaryColor: '#eab308'
      }
    });

    console.log('✅ BRANDING APPLIED!');
    console.log('✨ Burger Palace now has its Royal Logo.');
    console.log('💡 Note: You can now upload the generated images to your hosting and paste the URLs in the SuperAdmin dashboard.');
  } catch (error) {
    console.error('❌ Branding Update Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

applyLogos();
