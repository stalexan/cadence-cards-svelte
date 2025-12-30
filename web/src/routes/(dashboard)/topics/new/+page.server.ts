import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { topicService } from '$lib/server/services';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		const name = formData.get('name') as string;
		const topicDescription = formData.get('topicDescription') as string;
		const expertise = formData.get('expertise') as string;
		const focus = formData.get('focus') as string;
		const contextType = formData.get('contextType') as string;
		const example = formData.get('example') as string;
		const question = formData.get('question') as string;

		if (!name?.trim()) {
			return fail(400, {
				error: 'Topic name is required',
				name,
				topicDescription,
				expertise,
				focus,
				contextType,
				example,
				question
			});
		}

		const userId = parseInt(session.user.id, 10);

		try {
			const topic = await topicService.createTopic({
				userId,
				name: name.trim(),
				topicDescription: topicDescription?.trim() || undefined,
				expertise: expertise?.trim() || undefined,
				focus: focus?.trim() || undefined,
				contextType: contextType?.trim() || undefined,
				example: example?.trim() || undefined,
				question: question?.trim() || undefined
			});

			redirect(303, `/topics/${topic.id}`);
		} catch (error) {
			if (isRedirect(error)) throw error;
			console.error('Error creating topic:', error);
			return fail(500, {
				error: 'Failed to create topic',
				name,
				topicDescription,
				expertise,
				focus,
				contextType,
				example,
				question
			});
		}
	}
};
