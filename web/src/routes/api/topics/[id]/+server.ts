import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { topicService } from '$lib/server/services';

/**
 * GET /api/topics/[id] - Get a specific topic
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const topicId = parseInt(event.params.id, 10);

		const topic = await topicService.getTopicById(topicId, userId);
		if (!topic) {
			return json({ message: 'Topic not found' }, { status: 404 });
		}

		return json(topic);
	} catch (err) {
		return handleApiError(err, { operation: 'fetch_topic' });
	}
};

// Validation schema for updating a topic
const updateTopicSchema = z.object({
	name: z.string().min(1, 'Topic name is required'),
	topicDescription: z.string().optional(),
	expertise: z.string().optional(),
	focus: z.string().optional(),
	contextType: z.string().optional(),
	example: z.string().optional(),
	question: z.string().optional()
});

/**
 * PUT /api/topics/[id] - Update a topic
 */
export const PUT: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const topicId = parseInt(event.params.id, 10);
		const body = await event.request.json();
		const validatedData = updateTopicSchema.parse(body);

		const topic = await topicService.updateTopic(topicId, userId, validatedData);

		return json(topic);
	} catch (err) {
		return handleApiError(err, { operation: 'update_topic' });
	}
};

/**
 * DELETE /api/topics/[id] - Delete a topic
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const topicId = parseInt(event.params.id, 10);

		await topicService.deleteTopic(topicId, userId);

		return json({ success: true });
	} catch (err) {
		return handleApiError(err, { operation: 'delete_topic' });
	}
};
