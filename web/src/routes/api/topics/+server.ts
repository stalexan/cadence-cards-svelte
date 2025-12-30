import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { topicService } from '$lib/server/services';

/**
 * GET /api/topics - Get all topics for the current user
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const topics = await topicService.getTopics(userId);
		return json(topics);
	} catch (err) {
		return handleApiError(err, { operation: 'fetch_topics' });
	}
};

// Validation schema for creating a topic
const createTopicSchema = z.object({
	name: z.string().min(1, 'Topic name is required'),
	topicDescription: z.string().optional(),
	expertise: z.string().optional(),
	focus: z.string().optional(),
	contextType: z.string().optional(),
	example: z.string().optional(),
	question: z.string().optional()
});

/**
 * POST /api/topics - Create a new topic
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = await event.request.json();
		const validatedData = createTopicSchema.parse(body);

		const topic = await topicService.createTopic({
			userId,
			...validatedData
		});

		return json(topic, { status: 201 });
	} catch (err) {
		return handleApiError(err, { operation: 'create_topic' });
	}
};
