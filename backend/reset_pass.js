const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 12);
  const result = await prisma.user.updateMany({
    where: { role: 'superadmin', email: 'superadmin@elevatepos.com' },
    data: { password: hashedPassword }
  });
  console.log('Updated superadmin password. Rows affected:', result.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
