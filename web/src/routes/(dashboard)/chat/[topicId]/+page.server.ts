import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { topicService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/login');
	}

	const topicId = parseInt(event.params.topicId, 10);
	const userId = parseInt(session.user.id, 10);

	if (isNaN(topicId)) {
		throw redirect(303, '/chat');
	}

	try {
		const topic = await topicService.getTopicById(topicId, userId);
		if (!topic) {
			throw redirect(303, '/chat');
		}

		return { topic };
	} catch (error) {
		console.error('Error fetching topic for chat:', error);
		throw redirect(303, '/chat');
	}
};
