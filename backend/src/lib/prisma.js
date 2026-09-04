const { PrismaClient } = require('@prisma/client');

// Singleton pattern: Reuse one PrismaClient across the entire app.
// This prevents connection pool exhaustion on Supabase's free tier
// (which limits concurrent connections to ~15).
const prismaClient = new PrismaClient({
  log: ['error', 'warn'],
});

// Audit logging has been retired from this deployment. Keep old route code
// harmless while the database no longer contains the AuditLog table.
const prisma = prismaClient.$extends({
  query: {
    auditLog: {
      async create() { return null; },
      async findMany() { return []; },
      async count() { return 0; },
    },
  },
});

module.exports = prisma;
