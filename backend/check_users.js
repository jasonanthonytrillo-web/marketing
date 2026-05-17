if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
} else {
  const fs = require('fs');
  const path = require('path');
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const directLine = envFile.split('\n').find(line => line.startsWith('DIRECT_URL='));
    if (directLine) {
      const directUrl = directLine.split('DIRECT_URL=')[1].replace(/"/g, '').trim();
      process.env.DATABASE_URL = directUrl;
    }
  } catch (err) {}
}

const prisma = require('./src/lib/prisma');

async function run() {
  const users = await prisma.user.findMany({
    include: { tenant: true }
  });
  console.log("=== REGISTERED USERS ===");
  console.log(JSON.stringify(users.map(u => ({
    email: u.email,
    name: u.name,
    role: u.role,
    tenantSlug: u.tenant ? u.tenant.slug : 'NONE'
  })), null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
