import { prisma } from '$lib/server/db';
import type { TopicConfig, GeneratedPrompts } from '../types';

/**
 * Fetch and configure topic settings from database
 */
export async function getTopicConfig(topicId: string): Promise<TopicConfig> {
	const topic = await prisma.topic.findUnique({
		where: { id: parseInt(topicId) },
		select: {
			name: true,
			topicDescription: true,
			expertise: true,
			focus: true,
			contextType: true,
			example: true,
			question: true
		}
	});

	if (!topic) {
		throw new Error(`Topic not found: ${topicId}`);
	}

	return {
		TOPIC: topic.name,
		TOPIC_DESC: topic.topicDescription || topic.name,
		EXPERTISE: topic.expertise || 'tutor',
		FOCUS: topic.focus || 'concepts and principles',
		CONTEXT_TYPE: topic.contextType || 'additional context',
		EXAMPLE: topic.example || '',
		QUESTION: topic.question || ''
	};
}

/**
 * Generate all prompts for a topic
 */
export function generateTopicPrompts(config: TopicConfig): GeneratedPrompts {
	const identity = `You are a knowledgeable ${config.TOPIC} ${config.EXPERTISE}, specializing in ${config.TOPIC_DESC}. 
Your role is to help users practice and learn ${config.TOPIC} through flashcard exercises, 
provide explanations about ${config.FOCUS}, and offer ${config.CONTEXT_TYPE} when relevant.`;

	const staticContext = `
<static_context>
${config.TOPIC} Learning Assistant

Role:
- Help users practice ${config.TOPIC} ${config.FOCUS} through flashcards
- Provide clear explanations of ${config.TOPIC} concepts
- Offer ${config.CONTEXT_TYPE} for better understanding
- Guide users through their learning journey with patience and encouragement

Key Features:
- Focus on ${config.TOPIC} concepts and principles
- Contextual examples for better understanding
- Detailed explanations when needed
- Additional notes for deeper comprehension
</static_context>
`;

	let examples = `
Here are examples of how you should interact with learners:
`;

	// Add example if provided
	if (config.EXAMPLE && config.EXAMPLE.trim() !== '') {
		examples += `
<example 1>
${config.EXAMPLE}
</example 1>
`;
	} else {
		// Generic example
		examples += `
<example 1>
H: What's the difference between "concept A" and "concept B"?

A: Let me explain the difference between "concept A" and "concept B" in this topic:

[Explanation of the difference]

For example:
- [Example 1] - [Explanation]
- [Example 2] - [Explanation]
- [Example 3] - [Explanation]
- [Example 4] - [Explanation]
</example 1>
`;
	}

	// Generic flashcard example
	examples += `
<example 2>
H: [Practice mode - shown flashcard about a concept]

A: [Question about the concept shown on the flashcard]
</example 2>
`;

	const additionalGuardrails = `Please adhere to the following guidelines:
1. Always provide accurate information about ${config.TOPIC}
2. When relevant, point out different perspectives or approaches within ${config.TOPIC}
3. Provide contextual information when it adds value to understanding
4. Be encouraging and patient with learners
5. Use clear explanations appropriate to the learner's level
`;

	const practiceInstructions = `
We are now in practice mode. Help the user practice their ${config.TOPIC} knowledge using flashcards.

Important guidelines:
- Do not offer a "next card" option since there is a separate button for that
- Do not use images or say anything about showing images
- Don't say you are waiting for them
- Do not repeat back to the user any instructions you've been given
- If they ask for the answer, provide it along with a brief explanation of any important points
- For additional notes, focus specifically on how the concept is understood or used in the context of ${config.TOPIC}
`;

	return {
		IDENTITY: identity,
		STATIC_CONTEXT: staticContext,
		EXAMPLES: examples,
		ADDITIONAL_GUARDRAILS: additionalGuardrails,
		GENERAL_INSTRUCTIONS: staticContext + examples + additionalGuardrails,
		PRACTICE_INSTRUCTIONS: practiceInstructions
	};
}

/**
 * Helper to extract question from XML tags
 */
export function extractQuestionFromXML(text: string): string {
	const match = text.match(/<question>([\s\S]*?)<\/question>/);
	return match?.[1]?.trim() || text;
}

/**
 * Format card content as XML
 */
export function formatCardAsXML(front: string, back: string, note: string | null): string {
	let xml = `<front>${front}</front>\n<back>${back}</back>`;
	if (note) {
		xml += `\n<notes>${note}</notes>`;
	}
	return xml;
}
