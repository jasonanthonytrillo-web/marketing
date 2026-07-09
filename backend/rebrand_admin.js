const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Replacing "Project Million Admin" with "Hometown Brew Admin"...');

    const resultUser = await prisma.user.updateMany({
      where: {
        name: 'Project Million Admin'
      },
      data: {
        name: 'Hometown Brew Admin'
      }
    });
    console.log(`Updated ${resultUser.count} users.`);

    const logs = await prisma.auditLog.findMany({
      where: {
        details: {
          contains: 'Project Million Admin'
        }
      }
    });

    let count = 0;
    for (const log of logs) {
      if (log.details && log.details.includes('Project Million Admin')) {
        await prisma.auditLog.update({
          where: { id: log.id },
          data: {
            details: log.details.replace(/Project Million Admin/g, 'Hometown Brew Admin')
          }
        });
        count++;
      }
    }
    console.log(`Updated ${count} audit logs.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
