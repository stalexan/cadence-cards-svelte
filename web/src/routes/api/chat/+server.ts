import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { chatAboutTopic } from '$lib/server/claude';
import { prisma } from '$lib/server/db';

// Validation schema for chat request
const chatRequestSchema = z.object({
	message: z.string().min(1, 'Message is required'),
	topicId: z.string().min(1, 'Topic ID is required'),
	topicName: z.string().min(1, 'Topic name is required'),
	previousMessages: z.array(
		z.object({
			role: z.enum(['user', 'assistant']),
			content: z.string()
		})
	),
	isFirstMessage: z.boolean().optional().default(false)
});

/**
 * POST /api/chat - Chat with Claude about a topic
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = await event.request.json();

		const { message, topicId, previousMessages, isFirstMessage } = chatRequestSchema.parse(body);

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

		// Get response from Claude
		const response = await chatAboutTopic(message, previousMessages, topicId, isFirstMessage);

		return json({ response });
	} catch (err) {
		return handleApiError(err, {
			operation: 'chat_with_claude',
			customErrorMessage: 'Error chatting with Claude'
		});
	}
};
