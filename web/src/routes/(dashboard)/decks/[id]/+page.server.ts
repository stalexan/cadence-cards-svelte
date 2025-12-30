import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deckService, cardService } from '$lib/server/services';

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

		const cards = await cardService.getCards({ userId, deckId });

		return { deck, cards };
	} catch (error) {
		console.error('Error fetching deck details:', error);
		redirect(303, '/decks');
	}
};

export const actions: Actions = {
	delete: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const deckId = parseInt(event.params.id, 10);
		const userId = parseInt(session.user.id, 10);

		try {
			await deckService.deleteDeck(deckId, userId);
			redirect(303, '/decks');
		} catch (error) {
			if (isRedirect(error)) throw error;
			console.error('Error deleting deck:', error);
			return fail(500, { error: 'Failed to delete deck' });
		}
	},
	deleteCard: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		const cardId = formData.get('cardId');

		if (!cardId) {
			return fail(400, { error: 'Card ID is required' });
		}

		const userId = parseInt(session.user.id, 10);

		try {
			await cardService.deleteCard(parseInt(cardId.toString(), 10), userId);
			return { success: true };
		} catch (error) {
			console.error('Error deleting card:', error);
			return fail(500, { error: 'Failed to delete card' });
		}
	}
};
