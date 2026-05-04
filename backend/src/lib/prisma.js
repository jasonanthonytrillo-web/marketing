const { PrismaClient } = require('@prisma/client');

// Singleton pattern: Reuse one PrismaClient across the entire app.
// This prevents connection pool exhaustion on Supabase's free tier
// (which limits concurrent connections to ~15).
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

module.exports = prisma;
