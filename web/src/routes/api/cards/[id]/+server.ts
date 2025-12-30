import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { cardService } from '$lib/server/services';
import { Priority } from '$lib/sm2';

/**
 * GET /api/cards/[id] - Get a specific card
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const cardId = parseInt(event.params.id, 10);

		const card = await cardService.getCardById(cardId, userId);
		if (!card) {
			return json({ message: 'Card not found' }, { status: 404 });
		}

		return json(card);
	} catch (err) {
		return handleApiError(err, { operation: 'fetch_card' });
	}
};

// Validation schema for updating a card
const updateCardSchema = z.object({
	front: z.string().min(1, 'Front content is required'),
	back: z.string().min(1, 'Back content is required'),
	note: z.string().nullable().optional(),
	priority: z.enum([Priority.A, Priority.B, Priority.C]).optional(),
	tags: z.array(z.string()).optional()
});

/**
 * PUT /api/cards/[id] - Update a card
 */
export const PUT: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const cardId = parseInt(event.params.id, 10);
		const body = await event.request.json();
		const validatedData = updateCardSchema.parse(body);

		const card = await cardService.updateCard(cardId, userId, validatedData);

		return json(card);
	} catch (err) {
		return handleApiError(err, { operation: 'update_card' });
	}
};

/**
 * DELETE /api/cards/[id] - Delete a card
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const cardId = parseInt(event.params.id, 10);

		await cardService.deleteCard(cardId, userId);

		return json({ success: true });
	} catch (err) {
		return handleApiError(err, { operation: 'delete_card' });
	}
};
