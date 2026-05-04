const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('⏳ Attempting to connect to Supabase...');
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Connection SUCCESSFUL!');
    console.log('🕒 Server time:', result[0].now);
  } catch (err) {
    console.error('❌ Connection FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
