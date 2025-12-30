import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { studyService } from '$lib/server/services';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';

/**
 * GET /api/study/next-card - Get the next card for study based on priority and due status
 *
 * Query params:
 * - topicId (required): The topic to study
 * - deckIds[]: Optional array of deck IDs to filter by
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const url = new URL(event.request.url);

		// Parse query parameters
		const topicIdParam = url.searchParams.get('topicId');
		if (!topicIdParam) {
			return json({ message: 'Topic ID is required' }, { status: 400 });
		}

		const deckIds = url.searchParams.getAll('deckIds').map((id) => parseInt(id));

		// Delegate to service
		const nextCard = await studyService.getNextCard(
			{
				userId,
				topicId: parseInt(topicIdParam),
				deckIds
			},
			event.request
		);

		if (!nextCard) {
			return json({ message: 'No cards due for study' }, { status: 404 });
		}

		return json(nextCard);
	} catch (err) {
		return handleApiError(err, {
			operation: 'fetch_next_card',
			customErrorMessage: 'Error fetching next study card'
		});
	}
};
