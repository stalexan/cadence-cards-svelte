import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatAboutQuestion } from '$lib/server/claude';
import { z } from 'zod';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { prisma } from '$lib/server/db';

// Validation schema for chatting about a question
const chatAboutQuestionSchema = z.object({
	userAnswer: z.string().min(1, 'User answer is required'),
	cardFront: z.string().min(1, 'Card front is required'),
	cardBack: z.string().min(1, 'Card back is required'),
	cardNote: z.string().nullable().optional(),
	previousMessages: z.array(
		z.object({
			role: z.enum(['user', 'assistant']),
			content: z.string()
		})
	),
	topicName: z.string().optional().default('Spanish'),
	topicId: z.string().min(1, 'Topic ID is required')
});

/**
 * POST /api/study/chat-about-question - Chat about a user's answer to a flashcard
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = await event.request.json();

		// Validate request body
		const { userAnswer, cardFront, cardBack, cardNote, previousMessages, topicId } =
			chatAboutQuestionSchema.parse(body);

		// Verify topic belongs to the authenticated user
		const topic = await prisma.topic.findFirst({
			where: {
				id: parseInt(topicId),
				userId
			}
		});

		if (!topic) {
			return json({ message: 'Topic not found' }, { status: 404 });
		}

		// Chat about question using Claude.AI
		// The chatAboutQuestion function now handles filtering/adding context messages
		const response = await chatAboutQuestion(
			userAnswer,
			cardFront,
			cardBack,
			cardNote ?? null,
			previousMessages,
			topicId
		);

		return json({ response });
	} catch (err) {
		return handleApiError(err, {
			operation: 'chat_about_question',
			customErrorMessage: 'Error processing your answer'
		});
	}
};
