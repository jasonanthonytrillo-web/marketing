const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Updating branding for Burger Palace...');
  
  await prisma.tenant.update({
    where: { slug: 'burger-palace' },
    data: {
      primaryColor: '#e11d48', // Deep Crimson Red
      secondaryColor: '#fbbf24', // Golden Yellow
      bannerImage: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=2000&auto=format&fit=crop'
    }
  });

  console.log('Updating branding for Project Million (Platform)...');
  await prisma.tenant.update({
    where: { slug: 'project-million' },
    data: {
      primaryColor: '#4f46e5', // Indigo
      secondaryColor: '#0ea5e9', // Sky Blue
      bannerImage: 'https://images.unsplash.com/photo-1586816001966-79b736744398?q=80&w=2000&auto=format&fit=crop'
    }
  });

  console.log('Branding updated successfully! 🚀');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
