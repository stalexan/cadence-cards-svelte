import { generateText } from '../client';
import {
	getTopicConfig,
	generateTopicPrompts,
	extractQuestionFromXML,
	formatCardAsXML
} from '../prompts/study-assistance';
import type { ChatMessage } from '../types';

/**
 * Get initial welcome message for a topic
 */
export async function getInitialChatMessage(topicName: string, topicId: string): Promise<string> {
	try {
		const config = await getTopicConfig(topicId);
		const prompts = generateTopicPrompts(config);

		return await generateText({
			system: prompts.IDENTITY,
			messages: [{ role: 'user', content: prompts.GENERAL_INSTRUCTIONS }],
			temperature: 0.7
		});
	} catch (error) {
		console.error('Error generating initial message:', error);
		return `Hello! I'm Claude, your ${topicName} assistant. I'm here to help you study this topic. How can I assist you today?`;
	}
}

/**
 * Chat with Claude about a topic
 */
export async function chatAboutTopic(
	message: string,
	previousMessages: ChatMessage[],
	topicId: string,
	isFirstMessage: boolean = false
): Promise<string> {
	const config = await getTopicConfig(topicId);
	const prompts = generateTopicPrompts(config);

	let messages: ChatMessage[];

	if (isFirstMessage) {
		messages = [
			{ role: 'user', content: prompts.GENERAL_INSTRUCTIONS },
			{ role: 'assistant', content: 'Understood.' },
			{ role: 'user', content: message }
		];
	} else {
		messages = [...previousMessages, { role: 'user', content: message }];
	}

	return await generateText({
		system: prompts.IDENTITY,
		messages,
		temperature: 0.7
	});
}

/**
 * Generate a practice question for a flashcard
 */
export async function generateQuestion(
	cardFront: string,
	cardBack: string,
	cardNote: string | null,
	topicId: string
): Promise<string> {
	const config = await getTopicConfig(topicId);
	const prompts = generateTopicPrompts(config);

	const cardXML = formatCardAsXML(cardFront, cardBack, cardNote);

	let prompt = `Here's the card to create a question for:

<card>
${cardXML}
</card>

Place the question in an XML tag called question.`;

	if (config.QUESTION?.trim()) {
		prompt += '\n\n' + config.QUESTION;
	}

	const response = await generateText({
		system: prompts.IDENTITY,
		messages: [
			{ role: 'user', content: prompts.STATIC_CONTEXT },
			{
				role: 'assistant',
				content: 'I will help generate a practice question.'
			},
			{ role: 'user', content: prompt }
		],
		temperature: 0.7
	});

	return extractQuestionFromXML(response);
}

/**
 * Chat about a specific flashcard question
 */
export async function chatAboutQuestion(
	userAnswer: string,
	cardFront: string,
	cardBack: string,
	cardNote: string | null,
	previousMessages: ChatMessage[],
	topicId: string
): Promise<string> {
	const config = await getTopicConfig(topicId);
	const prompts = generateTopicPrompts(config);

	const cardXML = formatCardAsXML(cardFront, cardBack, cardNote);

	// Filter out context/instruction messages
	const visibleMessages = previousMessages.filter(
		(msg) =>
			!(
				(msg.role === 'user' && msg.content.includes(prompts.GENERAL_INSTRUCTIONS)) ||
				(msg.role === 'assistant' && msg.content === 'Understood.')
			)
	);

	const messages: ChatMessage[] = [
		{
			role: 'user',
			content: `${prompts.GENERAL_INSTRUCTIONS}\n\n${prompts.PRACTICE_INSTRUCTIONS}\n\nHere's the card to practice:\n<card>${cardXML}</card>`
		},
		{ role: 'assistant', content: 'Understood.' },
		...visibleMessages,
		{ role: 'user', content: userAnswer }
	];

	return await generateText({
		system: prompts.IDENTITY,
		messages
	});
}
