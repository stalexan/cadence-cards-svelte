import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateQuestion } from '$lib/server/claude';
import { z } from 'zod';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';

// Validation schema for generating a question
const generateQuestionSchema = z.object({
	cardFront: z.string().min(1, 'Card front is required'),
	cardBack: z.string().min(1, 'Card back is required'),
	cardNote: z.string().nullable().optional(),
	topicName: z.string().optional().default('Spanish'),
	topicId: z.string().min(1, 'Topic ID is required')
});

/**
 * POST /api/study/generate-question - Generate a question for a flashcard
 */
export const POST: RequestHandler = async (event) => {
	try {
		await requireAuth(event);
		const body = await event.request.json();

		// Validate request body
		const { cardFront, cardBack, cardNote, topicId } = generateQuestionSchema.parse(body);

		// Generate question using Claude.AI
		const question = await generateQuestion(cardFront, cardBack, cardNote || null, topicId);

		return json({ question });
	} catch (err) {
		return handleApiError(err, {
			operation: 'generate_question',
			customErrorMessage: 'Error generating question'
		});
	}
};
