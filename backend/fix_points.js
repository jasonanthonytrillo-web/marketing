const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUserPoints() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'jason@gmail.com' }
    });

    if (!user) {
      // Try jason@gmail if the user made a typo
      const user2 = await prisma.user.findUnique({ where: { email: 'jason@gmail' } });
      if (user2) return fix(user2);
      console.log('User not found');
      return;
    }

    await fix(user);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

async function fix(user) {
  console.log(`Current points for ${user.email}: ${user.points}`);
  
  // Update points (add 50)
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { points: { increment: 50 } }
  });
  
  console.log(`Updated points for ${user.email}: ${updated.points}`);
}

fixUserPoints();
