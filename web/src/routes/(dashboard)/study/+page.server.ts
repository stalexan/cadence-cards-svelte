import type { PageServerLoad } from './$types';
import { topicService, studyService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		return { topics: [], topicStats: {} };
	}

	const userId = parseInt(session.user.id, 10);

	try {
		const topics = await topicService.getTopics(userId);

		// Fetch study stats for each topic
		const topicStats: Record<
			number,
			{ dueCards: { total: number; priorityA: number; priorityB: number; priorityC: number } }
		> = {};

		for (const topic of topics) {
			try {
				const stats = await studyService.getStudyStats({
					userId,
					topicId: topic.id,
					deckIds: []
				});
				topicStats[topic.id] = stats;
			} catch {
				// Ignore errors for individual topics
			}
		}

		return { topics, topicStats };
	} catch (error) {
		console.error('Error fetching study data:', error);
		return { topics: [], topicStats: {} };
	}
};
