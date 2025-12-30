import type { PageServerLoad } from './$types';
import { dashboardService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		return { stats: null };
	}

	const userId = parseInt(session.user.id, 10);

	try {
		const stats = await dashboardService.getDashboardStats(userId);
		return { stats };
	} catch (error) {
		console.error('Error fetching dashboard stats:', error);
		return { stats: null };
	}
};
