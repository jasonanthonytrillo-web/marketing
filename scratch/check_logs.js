const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLogs() {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    
    console.log('--- RECENT AUDIT LOGS ---');
    logs.forEach(log => {
      console.log(`[${log.createdAt.toISOString()}] ${log.action} | User: ${log.user?.name || 'System'} | Details: ${log.details}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkLogs();
