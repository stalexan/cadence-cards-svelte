import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { topicService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/login');
	}

	const userId = parseInt(session.user.id, 10);

	try {
		const topics = await topicService.getTopics(userId);
		return { topics };
	} catch (error) {
		console.error('Error fetching topics for chat:', error);
		return { topics: [] };
	}
};
