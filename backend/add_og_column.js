const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addOgImage() {
  console.log('Adding ogImage column to Tenant table...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ogImage" TEXT`);
    console.log('✅ ogImage column added successfully!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

addOgImage();
