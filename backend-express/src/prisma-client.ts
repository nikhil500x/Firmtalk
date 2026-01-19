import { PrismaClient } from './generated/prisma/client';
import 'dotenv/config';

// Configure connection pool settings in DATABASE_URL
// For pgbouncer in session mode, use a conservative connection limit
// Supabase pgbouncer typically allows 1-4 connections in session mode
let databaseUrl = process.env.DATABASE_URL || '';
// if (databaseUrl) {
//   // For pgbouncer, we need to use a lower connection_limit to match pooler limits
//   // If using Supabase pooler, typical limits are 1-4 connections
//   const isPgbouncer = databaseUrl.includes('pgbouncer=true') || databaseUrl.includes('pooler.supabase.com');
  
//   if (isPgbouncer) {
//     // For pgbouncer in session mode, use connection_limit=1 to match pooler capacity
//     // Session mode typically allows only 1 connection per client
//     if (databaseUrl.includes('connection_limit=')) {
//       // Replace existing connection_limit with 1 for pgbouncer session mode
//       databaseUrl = databaseUrl.replace(/connection_limit=\d+/g, 'connection_limit=1');
//     } else {
//       // Add connection_limit if not present
//       const separator = databaseUrl.includes('?') ? '&' : '?';
//       databaseUrl = `${databaseUrl}${separator}connection_limit=1`;
//     }
//   } else {
//     // For direct connections, use higher limit
//     if (databaseUrl.includes('connection_limit=')) {
//       databaseUrl = databaseUrl.replace(/connection_limit=\d+/g, 'connection_limit=10');
//     } else {
//       const separator = databaseUrl.includes('?') ? '&' : '?';
//       databaseUrl = `${databaseUrl}${separator}connection_limit=10`;
//     }
//   }
  
//   // Replace or add pool_timeout parameter
//   if (databaseUrl.includes('pool_timeout=')) {
//     databaseUrl = databaseUrl.replace(/pool_timeout=\d+/g, 'pool_timeout=10');
//   } else {
//     databaseUrl = `${databaseUrl}&pool_timeout=10`;
//   }
// }

// Configure Prisma client with connection pool settings
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

// Handle connection pool errors gracefully
prisma.$on('error' as never, (e: any) => {
  console.error('Prisma Client Error:', e);
  // If it's a connection pool error, try to disconnect and reconnect
  if (e.message && e.message.includes('MaxClientsInSessionMode')) {
    console.error('⚠️ Connection pool exhausted. Consider reducing connection_limit or checking for connection leaks.');
  }
});

// Ensure connections are properly closed on app termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});


export default prisma;

