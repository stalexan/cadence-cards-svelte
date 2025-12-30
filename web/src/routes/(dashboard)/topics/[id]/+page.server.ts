import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { topicService, deckService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(303, '/login');
	}

	const topicId = parseInt(event.params.id, 10);
	const userId = parseInt(session.user.id, 10);

	if (isNaN(topicId)) {
		redirect(303, '/topics');
	}

	try {
		const topic = await topicService.getTopicById(topicId, userId);
		if (!topic) {
			redirect(303, '/topics');
		}

		const decks = await deckService.getDecks(userId, topicId);

		return { topic, decks };
	} catch (error) {
		console.error('Error fetching topic details:', error);
		redirect(303, '/topics');
	}
};

export const actions: Actions = {
	delete: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const topicId = parseInt(event.params.id, 10);
		const userId = parseInt(session.user.id, 10);

		try {
			await topicService.deleteTopic(topicId, userId);
			redirect(303, '/topics');
		} catch (error) {
			if (isRedirect(error)) throw error;
			console.error('Error deleting topic:', error);
			return fail(500, { error: 'Failed to delete topic' });
		}
	}
};
