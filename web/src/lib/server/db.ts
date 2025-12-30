import { PrismaClient } from '@prisma/client';

// Declare global variable for PrismaClient
declare global {
	var prisma: PrismaClient | undefined;
}

// Create client with connection pooling and logging configuration
const prisma =
	globalThis.prisma ||
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});

// In development, store the client on the global object to prevent
// multiple instances during hot reloading
if (process.env.NODE_ENV !== 'production') {
	globalThis.prisma = prisma;
}

export { prisma };
export default prisma;
