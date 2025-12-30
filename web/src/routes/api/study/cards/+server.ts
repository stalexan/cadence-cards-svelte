import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { studyService } from '$lib/server/services';

/**
 * GET /api/study/cards - Get the next card for study session
 *
 * Query params:
 * - topicId (required): The topic to study
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

		const card = await studyService.getNextCard(
			{
				userId,
				topicId: parseInt(topicIdParam),
				deckIds
			},
			event.request
		);

		return json(card);
	} catch (err) {
		return handleApiError(err, {
			operation: 'fetch_study_cards',
			customErrorMessage: 'Error fetching study cards'
		});
	}
};
