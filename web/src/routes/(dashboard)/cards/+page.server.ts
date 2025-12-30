import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { cardService, topicService, deckService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		return { cards: [], topics: [], decks: [] };
	}

	const userId = parseInt(session.user.id, 10);

	try {
		const [cards, topics, decks] = await Promise.all([
			cardService.getCards({ userId }),
			topicService.getTopics(userId),
			deckService.getDecks(userId)
		]);

		// Extract unique tags
		const tags = new Set<string>();
		cards.forEach((card) => {
			if (card.tags) {
				card.tags.forEach((tag: string) => tags.add(tag));
			}
		});

		return {
			cards,
			topics,
			decks,
			availableTags: Array.from(tags)
		};
	} catch (error) {
		console.error('Error fetching cards data:', error);
		return { cards: [], topics: [], decks: [], availableTags: [] };
	}
};

export const actions: Actions = {
	delete: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		const cardId = formData.get('id');

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
