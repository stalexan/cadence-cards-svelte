import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { deckService } from '$lib/server/services';

/**
 * GET /api/topics/[id]/decks - Get all decks for a topic
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const topicId = parseInt(event.params.id, 10);

		const decks = await deckService.getDecks(userId, topicId);

		return json({ decks });
	} catch (err) {
		return handleApiError(err, { operation: 'fetch_topic_decks' });
	}
};
