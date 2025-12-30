import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { studyService } from '$lib/server/services';

/**
 * GET /api/study/stats - Get study statistics for selected topic and decks
 *
 * Query params:
 * - topicId (required): The topic to get stats for
 * - deckIds[]: Optional array of deck IDs to filter by
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const url = event.url;

		const topicIdParam = url.searchParams.get('topicId');
		if (!topicIdParam) {
			return json({ message: 'Topic ID is required' }, { status: 400 });
		}

		const deckIds = url.searchParams.getAll('deckIds').map((id) => parseInt(id));

		const stats = await studyService.getStudyStats({
			userId,
			topicId: parseInt(topicIdParam),
			deckIds
		});

		return json(stats);
	} catch (err) {
		return handleApiError(err, {
			operation: 'fetch_study_stats',
			customErrorMessage: 'Error fetching study stats'
		});
	}
};
