import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { topicService, deckService, studyService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/login');
	}

	const topicId = parseInt(event.params.topicId, 10);
	const userId = parseInt(session.user.id, 10);
	const deckIdParam = event.url.searchParams.get('deckId');

	if (isNaN(topicId)) {
		throw redirect(303, '/study');
	}

	try {
		const topic = await topicService.getTopicById(topicId, userId);
		if (!topic) {
			throw redirect(303, '/study');
		}

		const decks = await deckService.getDecks(userId, topicId);
		const stats = await studyService.getStudyStats({
			userId,
			topicId,
			deckIds: []
		});

		return {
			topic,
			decks,
			stats,
			initialDeckId: deckIdParam ? parseInt(deckIdParam, 10) : null
		};
	} catch (error) {
		console.error('Error fetching study setup data:', error);
		throw redirect(303, '/study');
	}
};
