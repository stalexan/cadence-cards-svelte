import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deckService, importService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/login');
	}

	const userId = parseInt(session.user.id, 10);

	try {
		const decks = await deckService.getDecks(userId);
		return { decks };
	} catch (error) {
		console.error('Error fetching decks for import:', error);
		return { decks: [] };
	}
};

export const actions: Actions = {
	default: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		const yamlContent = formData.get('yamlContent') as string;
		const deckId = formData.get('deckId') as string;

		if (!yamlContent?.trim()) {
			return fail(400, { error: 'YAML content is required' });
		}

		if (!deckId) {
			return fail(400, { error: 'Please select a deck' });
		}

		const userId = parseInt(session.user.id, 10);

		try {
			const result = await importService.importCards({
				userId,
				yamlContent,
				deckId: parseInt(deckId, 10)
			});

			return {
				success: true,
				imported: result.importedCount,
				skipped: result.failedCount,
				errors: result.errors
			};
		} catch (error) {
			console.error('Error importing cards:', error);
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to import cards'
			});
		}
	}
};
