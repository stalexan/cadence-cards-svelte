import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { deckService } from '$lib/server/services';

/**
 * GET /api/decks/[id] - Get a specific deck
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const deckId = parseInt(event.params.id, 10);

		const deck = await deckService.getDeckById(deckId, userId);
		if (!deck) {
			return json({ message: 'Deck not found' }, { status: 404 });
		}

		return json(deck);
	} catch (err) {
		return handleApiError(err, { operation: 'fetch_deck' });
	}
};

// Validation schema for updating a deck
const updateDeckSchema = z.object({
	name: z.string().min(1, 'Deck name is required'),
	field1Label: z.string().optional(),
	field2Label: z.string().optional(),
	isBidirectional: z.boolean().optional()
});

/**
 * PUT /api/decks/[id] - Update a deck
 */
export const PUT: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const deckId = parseInt(event.params.id, 10);
		const body = await event.request.json();
		const validatedData = updateDeckSchema.parse(body);

		const deck = await deckService.updateDeck(deckId, userId, validatedData);

		return json(deck);
	} catch (err) {
		return handleApiError(err, { operation: 'update_deck' });
	}
};

/**
 * DELETE /api/decks/[id] - Delete a deck
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const deckId = parseInt(event.params.id, 10);

		await deckService.deleteDeck(deckId, userId);

		return json({ success: true });
	} catch (err) {
		return handleApiError(err, { operation: 'delete_deck' });
	}
};
