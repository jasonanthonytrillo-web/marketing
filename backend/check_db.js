const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.expense.count();
    console.log('Expense count:', count);
  } catch (e) {
    console.error('Error querying Expense table:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
