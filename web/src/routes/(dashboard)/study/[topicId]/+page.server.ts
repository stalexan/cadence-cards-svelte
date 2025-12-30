import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { topicService } from '$lib/server/services';
import { studyService } from '$lib/server/services';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw redirect(302, '/login');
	}

	const userId = parseInt(session.user.id);
	const topicId = parseInt(params.topicId);
	const deckIdsParam = url.searchParams.get('deckIds');
	const deckIds = deckIdsParam ? deckIdsParam.split(',').map((id) => parseInt(id)) : [];

	// Fetch topic details
	const topic = await topicService.getTopicById(topicId, userId);
	if (!topic) {
		throw redirect(302, '/study');
	}

	// Fetch initial study statistics
	const stats = await studyService.getStudyStats({
		userId,
		topicId,
		deckIds
	});

	return {
		topic: {
			id: topic.id,
			name: topic.name
		},
		deckIds,
		initialStats: stats,
		totalCards: stats.dueCards.total
	};
};
