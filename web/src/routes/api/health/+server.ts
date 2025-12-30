import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/health - Health check endpoint for Docker/infrastructure monitoring
 */
export const GET: RequestHandler = async () => {
	return json({ status: 'ok' });
};

