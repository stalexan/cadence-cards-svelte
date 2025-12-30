import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deckService, topicService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(303, '/login');
	}

	const deckId = parseInt(event.params.id, 10);
	const userId = parseInt(session.user.id, 10);

	if (isNaN(deckId)) {
		redirect(303, '/decks');
	}

	try {
		const deck = await deckService.getDeckById(deckId, userId);
		if (!deck) {
			redirect(303, '/decks');
		}

		const topics = await topicService.getTopics(userId);

		return { deck, topics };
	} catch (error) {
		console.error('Error fetching deck:', error);
		redirect(303, '/decks');
	}
};

export const actions: Actions = {
	default: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const deckId = parseInt(event.params.id, 10);
		const userId = parseInt(session.user.id, 10);

		const formData = await event.request.formData();
		const name = formData.get('name') as string;
		const field1Label = formData.get('field1Label') as string;
		const field2Label = formData.get('field2Label') as string;
		const isBidirectional = formData.get('isBidirectional') === 'on';

		if (!name?.trim()) {
			return fail(400, { error: 'Deck name is required' });
		}

		try {
			await deckService.updateDeck(deckId, userId, {
				name: name.trim(),
				field1Label: field1Label?.trim() || undefined,
				field2Label: field2Label?.trim() || undefined,
				isBidirectional
			});

			redirect(303, `/decks/${deckId}`);
		} catch (error) {
			if (isRedirect(error)) throw error;
			console.error('Error updating deck:', error);
			return fail(500, { error: 'Failed to update deck' });
		}
	}
};
