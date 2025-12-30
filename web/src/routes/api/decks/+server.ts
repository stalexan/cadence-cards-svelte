import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { deckService } from '$lib/server/services';

/**
 * GET /api/decks - Get all decks for the current user
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const decks = await deckService.getDecks(userId);
		return json(decks);
	} catch (err) {
		return handleApiError(err, { operation: 'fetch_decks' });
	}
};

// Validation schema for creating a deck
const createDeckSchema = z.object({
	name: z.string().min(1, 'Deck name is required'),
	topicId: z.number().int().positive('Topic ID is required'),
	field1Label: z.string().optional(),
	field2Label: z.string().optional(),
	isBidirectional: z.boolean().default(false)
});

/**
 * POST /api/decks - Create a new deck
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = await event.request.json();
		const validatedData = createDeckSchema.parse(body);

		const deck = await deckService.createDeck({
			userId,
			...validatedData
		});

		return json(deck, { status: 201 });
	} catch (err) {
		return handleApiError(err, { operation: 'create_deck' });
	}
};
