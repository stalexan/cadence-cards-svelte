import { redirect, fail, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { topicService, deckService, cardService } from '$lib/server/services';
import { Priority } from '$lib/sm2';

export const load: PageServerLoad = async ({ url, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		redirect(302, '/login');
	}

	const userId = parseInt(session.user.id);
	const initialDeckId = url.searchParams.get('deckId');

	const [topics, decks] = await Promise.all([
		topicService.getTopics(userId),
		deckService.getDecks(userId)
	]);

	// If we have an initial deck ID, find the associated topic
	let initialTopicId: number | null = null;
	if (initialDeckId) {
		const deck = decks.find((d: { id: number }) => d.id === parseInt(initialDeckId));
		if (deck) {
			initialTopicId = deck.topicId;
		}
	}

	return {
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
		),
		initialDeckId: initialDeckId ? parseInt(initialDeckId) : null,
		initialTopicId
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) {
			redirect(302, '/login');
		}

		const userId = parseInt(session.user.id);
		const formData = await request.formData();

		const front = formData.get('front') as string;
		const back = formData.get('back') as string;
		const note = (formData.get('note') as string) || null;
		const priority = formData.get('priority') as string;
		const deckId = parseInt(formData.get('deckId') as string);
		const tags = formData.getAll('tags') as string[];

		if (!front || !back || !priority || !deckId) {
			return fail(400, { error: 'Please fill in all required fields' });
		}

		try {
			await cardService.createCard({
				front,
				back,
				note,
				priority: priority as Priority,
				deckId,
				tags,
				userId
			});

			redirect(302, `/decks/${deckId}`);
		} catch (error) {
			if (isRedirect(error)) throw error;
			return fail(500, { error: 'Failed to create card' });
		}
	}
};
