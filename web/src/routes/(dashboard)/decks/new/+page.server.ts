import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { topicService, deckService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(303, '/login');
	}

	const userId = parseInt(session.user.id, 10);
	const topicId = event.url.searchParams.get('topicId');

	try {
		const topics = await topicService.getTopics(userId);
		return {
			topics,
			initialTopicId: topicId ? parseInt(topicId, 10) : null
		};
	} catch (error) {
		console.error('Error fetching topics:', error);
		return { topics: [], initialTopicId: null };
	}
};

export const actions: Actions = {
	default: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		const name = formData.get('name') as string;
		const topicId = formData.get('topicId') as string;
		const field1Label = formData.get('field1Label') as string;
		const field2Label = formData.get('field2Label') as string;
		const isBidirectional = formData.get('isBidirectional') === 'on';

		if (!name?.trim()) {
			return fail(400, { error: 'Deck name is required' });
		}

		if (!topicId) {
			return fail(400, { error: 'Please select a topic' });
		}

		const userId = parseInt(session.user.id, 10);

		try {
			const deck = await deckService.createDeck({
				userId,
				name: name.trim(),
				topicId: parseInt(topicId, 10),
				field1Label: field1Label?.trim() || undefined,
				field2Label: field2Label?.trim() || undefined,
				isBidirectional
			});

			redirect(303, `/decks/${deck.id}`);
		} catch (error) {
			if (isRedirect(error)) throw error;
			console.error('Error creating deck:', error);
			return fail(500, { error: 'Failed to create deck' });
		}
	}
};
