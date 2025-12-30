import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { dashboardService } from '$lib/server/services';

/**
 * GET /api/dashboard/stats - Get dashboard statistics
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const stats = await dashboardService.getDashboardStats(userId);
		return json(stats);
	} catch (err) {
		return handleApiError(err, {
			operation: 'fetch_dashboard_stats',
			customErrorMessage: 'Error fetching dashboard stats'
		});
	}
};
