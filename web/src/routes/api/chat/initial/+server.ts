import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { getInitialChatMessage } from '$lib/server/claude';
import { prisma } from '$lib/server/db';

// Validation schema for initial chat request
const initialChatRequestSchema = z.object({
	topicId: z.string().min(1, 'Topic ID is required'),
	topicName: z.string().min(1, 'Topic name is required')
});

/**
 * POST /api/chat/initial - Get initial welcome message from Claude
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = await event.request.json();

		const { topicId, topicName } = initialChatRequestSchema.parse(body);

		// Check if topic belongs to user
		const topic = await prisma.topic.findFirst({
			where: {
				id: parseInt(topicId),
				userId
			}
		});

		if (!topic) {
			return json({ message: 'Topic not found or does not belong to the user' }, { status: 404 });
		}

		// Get initial welcome message from Claude
		const response = await getInitialChatMessage(topicName, topicId);

		return json({ response });
	} catch (err) {
		return handleApiError(err, {
			operation: 'get_initial_chat_message',
			customErrorMessage: 'Error getting initial message'
		});
	}
};
