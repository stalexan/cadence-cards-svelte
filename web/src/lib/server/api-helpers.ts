import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from './logger';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Options for error handling wrapper
 */
export interface ErrorHandlerOptions {
	/** Operation name for logging and error messages */
	operation: string;
	/** Optional custom error message override */
	customErrorMessage?: string;
}

/**
 * Get user ID from session or throw an error
 */
export async function requireAuth(event: RequestEvent): Promise<number> {
	const session = await event.locals.auth();

	if (!session?.user?.id) {
		throw error(401, 'Unauthorized');
	}

	return parseInt(session.user.id, 10);
}

/**
 * Create a JSON response
 */
export function jsonResponse<T>(data: T, status = 200) {
	return json(data, { status });
}

/**
 * Handle errors in API routes with standardized responses
 */
export function handleApiError(err: unknown, options: ErrorHandlerOptions): Response {
	const context = { operation: options.operation };

	// Handle Zod validation errors
	if (err instanceof z.ZodError) {
		logger.warn('Validation error', {
			...context,
			validationErrors: err.errors
		});
		return json(
			{
				message: 'Validation failed',
				errors: err.errors.map((e) => ({
					path: e.path.join('.'),
					message: e.message
				}))
			},
			{ status: 400 }
		);
	}

	// Handle Prisma errors
	if (err instanceof Prisma.PrismaClientKnownRequestError) {
		// Resource not found
		if (err.code === 'P2025') {
			logger.warn('Resource not found', {
				...context,
				prismaCode: err.code
			});
			return json({ message: 'Resource not found' }, { status: 404 });
		}

		// Unique constraint violation
		if (err.code === 'P2002') {
			logger.warn('Unique constraint violation', {
				...context,
				prismaCode: err.code,
				meta: err.meta
			});
			return json({ message: 'A record with this value already exists' }, { status: 409 });
		}

		// Foreign key constraint violation
		if (err.code === 'P2003') {
			logger.warn('Foreign key constraint violation', {
				...context,
				prismaCode: err.code
			});
			return json({ message: 'Referenced record does not exist' }, { status: 400 });
		}
	}

	// Handle Prisma validation errors
	if (err instanceof Prisma.PrismaClientValidationError) {
		logger.warn('Prisma validation error', { ...context });
		return json({ message: 'Invalid data format' }, { status: 400 });
	}

	// Default error handling
	const errorMessage = options.customErrorMessage || `Error in ${options.operation}`;
	logger.error(errorMessage, err, context);
	return json({ message: errorMessage }, { status: 500 });
}
