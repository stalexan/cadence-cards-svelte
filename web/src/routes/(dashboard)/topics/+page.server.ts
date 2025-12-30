import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { topicService } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		return { topics: [] };
	}

	const userId = parseInt(session.user.id, 10);

	try {
		const topics = await topicService.getTopics(userId);
		return { topics };
	} catch (error) {
		console.error('Error fetching topics:', error);
		return { topics: [] };
	}
};

export const actions: Actions = {
	delete: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		const topicId = formData.get('id');

		if (!topicId) {
			return fail(400, { error: 'Topic ID is required' });
		}

		const userId = parseInt(session.user.id, 10);

		try {
			await topicService.deleteTopic(parseInt(topicId.toString(), 10), userId);
			return { success: true };
		} catch (error) {
			console.error('Error deleting topic:', error);
			return fail(500, { error: 'Failed to delete topic' });
		}
	}
};
