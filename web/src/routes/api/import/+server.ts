import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { importService } from '$lib/server/services';

// Validation schema for import
const importSchema = z.object({
	yamlContent: z.string().min(1, 'YAML content is required'),
	deckId: z.number().int().positive('Deck ID is required')
});

/**
 * POST /api/import - Import cards from YAML
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = await event.request.json();
		const validatedData = importSchema.parse(body);

		const result = await importService.importCards({
			userId,
			...validatedData
		});

		return json(result);
	} catch (err) {
		return handleApiError(err, { operation: 'import_cards' });
	}
};
