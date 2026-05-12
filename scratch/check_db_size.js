const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSize() {
  try {
    const dbSize = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database()))`;
    const tableSizes = await prisma.$queryRaw`
      SELECT
        relname AS "Table",
        pg_size_pretty(pg_total_relation_size(relid)) AS "Size"
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC;
    `;
    
    console.log('--- Database Size ---');
    console.log(dbSize);
    console.log('\n--- Table Sizes ---');
    console.table(tableSizes);
  } catch (err) {
    console.error('Error checking size:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSize();
