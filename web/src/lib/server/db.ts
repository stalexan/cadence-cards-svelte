import { PrismaClient } from '$lib/server/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Declare global variable for PrismaClient
declare global {
	var prisma: PrismaClient | undefined;
}

// Prisma 7 requires a driver adapter. PrismaPg manages a node-postgres
// connection pool; DATABASE_URL is supplied by the container environment.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Create client with the Postgres adapter and logging configuration
const prisma =
	globalThis.prisma ||
	new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});

// In development, store the client on the global object to prevent
// multiple instances during hot reloading
if (process.env.NODE_ENV !== 'production') {
	globalThis.prisma = prisma;
}

export { prisma };
export default prisma;
