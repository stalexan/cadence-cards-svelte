import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { cardService, type CardQueryParams } from '$lib/server/services';
import { Priority } from '$lib/sm2';

/**
 * GET /api/cards - Get all cards for the current user
 *
 * Query params:
 * - deckId: Filter by deck ID
 * - topicId: Filter by topic ID
 * - priority: Filter by priority (A, B, or C)
 * - isDue: Only return cards that are due for study
 * - tag: Filter by tag
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const url = event.url;

		// Parse and validate query parameters
		const deckIdParam = url.searchParams.get('deckId');
		const topicIdParam = url.searchParams.get('topicId');

		const queryParams: CardQueryParams = {
			userId,
			deckId: deckIdParam ? parseInt(deckIdParam) : undefined,
			topicId: topicIdParam ? parseInt(topicIdParam) : undefined,
			priority: url.searchParams.get('priority') as Priority | undefined,
			isDue: url.searchParams.get('isDue') === 'true',
			tag: url.searchParams.get('tag') || undefined
		};

		const cards = await cardService.getCards(queryParams);

		return json(cards);
	} catch (err) {
		return handleApiError(err, { operation: 'fetch_cards' });
	}
};

// Validation schema for creating a card
const createCardSchema = z.object({
	front: z.string().min(1, 'Front content is required'),
	back: z.string().min(1, 'Back content is required'),
	note: z.string().nullable().optional(),
	priority: z.enum([Priority.A, Priority.B, Priority.C]),
	tags: z.array(z.string()).optional().default([]),
	deckId: z.number().int().positive('Deck ID is required'),
	claudeAssisted: z.boolean().optional().default(false),
	instructionPrompt: z.string().optional()
});

/**
 * POST /api/cards - Create a new card
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = await event.request.json();
		const validatedData = createCardSchema.parse(body);

		const card = await cardService.createCard({
			userId,
			...validatedData
		});

		return json(card, { status: 201 });
	} catch (err) {
		return handleApiError(err, { operation: 'create_card' });
	}
};
