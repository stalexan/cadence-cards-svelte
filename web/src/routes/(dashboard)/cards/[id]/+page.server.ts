import { redirect, fail, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { cardService, topicService, deckService, scheduleService } from '$lib/server/services';
import { Priority } from '$lib/sm2';

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/login');
	}

	const userId = parseInt(session.user.id);
	const cardId = parseInt(params.id);

	try {
		const card = await cardService.getCardById(cardId, userId);

		const [topics, decks] = await Promise.all([
			topicService.getTopics(userId),
			deckService.getDecks(userId)
		]);

		return {
			card,
			topics: topics.map((t: { id: number; name: string }) => ({ id: t.id, name: t.name })),
			decks: decks.map(
				(d: {
					id: number;
					name: string;
					topicId: number;
					field1Label: string | null;
					field2Label: string | null;
				}) => ({
					id: d.id,
					name: d.name,
					topicId: d.topicId,
					field1Label: d.field1Label,
					field2Label: d.field2Label
				})
			)
		};
	} catch {
		redirect(302, '/cards');
	}
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) {
			redirect(302, '/login');
		}

		const userId = parseInt(session.user.id);
		const cardId = parseInt(params.id);
		const formData = await request.formData();

		const front = formData.get('front') as string;
		const back = formData.get('back') as string;
		const note = (formData.get('note') as string) || null;
		const priority = formData.get('priority') as string;
		const deckId = parseInt(formData.get('deckId') as string);
		const tags = formData.getAll('tags') as string[];
		const version = parseInt(formData.get('version') as string);

		if (!front || !back || !priority || !deckId) {
			return fail(400, { error: 'Please fill in all required fields' });
		}

		try {
			const updatedCard = await cardService.updateCard(cardId, userId, {
				front,
				back,
				note,
				priority: priority as Priority,
				deckId,
				tags,
				version
			});

			return { success: true, card: updatedCard };
		} catch (error) {
			if (error instanceof Error && error.message.includes('VERSION_CONFLICT')) {
				return fail(409, {
					error: 'This card was modified elsewhere. Please refresh the page and try again.'
				});
			}
			return fail(500, { error: 'Failed to update card' });
		}
	},

	delete: async ({ params, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) {
			redirect(302, '/login');
		}

		const userId = parseInt(session.user.id);
		const cardId = parseInt(params.id);

		try {
			await cardService.deleteCard(cardId, userId);
			redirect(302, '/cards');
		} catch (error) {
			if (isRedirect(error)) throw error;
			return fail(500, { error: 'Failed to delete card' });
		}
	},

	resetProgress: async ({ params, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) {
			redirect(302, '/login');
		}

		const userId = parseInt(session.user.id);
		const cardId = parseInt(params.id);

		try {
			// Get the card to find its schedules
			const card = await cardService.getCardById(cardId, userId);
			if (!card || !card.schedules || card.schedules.length === 0) {
				return fail(404, { error: 'No schedules found for this card' });
			}

			// Reset all schedules using the service method
			const resetPromises = card.schedules.map((schedule: { id: number }) =>
				scheduleService.resetProgress(schedule.id, userId)
			);
			await Promise.all(resetPromises);

			return { success: true };
		} catch {
			return fail(500, { error: 'Failed to reset card progress' });
		}
	}
};
