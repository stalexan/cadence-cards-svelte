import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deckService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		return { decks: [] };
	}

	const userId = parseInt(session.user.id, 10);

	try {
		const decks = await deckService.getDecks(userId);
		return { decks };
	} catch (error) {
		console.error('Error fetching decks:', error);
		return { decks: [] };
	}
};

export const actions: Actions = {
	delete: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		const deckId = formData.get('id');

		if (!deckId) {
			return fail(400, { error: 'Deck ID is required' });
		}

		const userId = parseInt(session.user.id, 10);

		try {
			await deckService.deleteDeck(parseInt(deckId.toString(), 10), userId);
			return { success: true };
		} catch (error) {
			console.error('Error deleting deck:', error);
			return fail(500, { error: 'Failed to delete deck' });
		}
	}
};
