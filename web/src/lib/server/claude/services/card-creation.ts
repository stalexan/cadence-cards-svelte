import { Priority } from '$lib/sm2';
import {
	CARD_CREATION_PROMPT,
	CARD_REFINEMENT_PROMPT,
	CARD_CREATION_SYSTEM_PROMPT
} from '../prompts/card-creation';

/**
 * Interface for card generation request parameters
 */
interface CardGenerationParams {
	instruction: string;
	topicName: string;
	deckName: string;
}

/**
 * Interface for parsed card response data
 */
interface ParsedCardResponse {
	front?: string;
	back?: string;
	note?: string;
	priority?: Priority;
	tags?: string[];
	message?: string; // For refinement responses
}

/**
 * Format a structured prompt for card creation
 * @param params Parameters for card generation request
 * @returns Formatted prompt string for Claude
 */
export function formatCardPrompt(params: CardGenerationParams): string {
	const { instruction, topicName, deckName } = params;

	return CARD_CREATION_PROMPT.replace('{{TOPIC_NAME}}', topicName)
		.replace('{{DECK_NAME}}', deckName)
		.replace(/{{INSTRUCTION}}/g, instruction);
}

/**
 * Parse Claude's response to extract structured card data
 * @param responseText Raw text response from Claude
 * @returns Parsed card data with front, back, note, priority, and tags
 */
export function parseCardResponse(responseText: string): ParsedCardResponse {
	const result: ParsedCardResponse = {};

	// Extract front content
	const frontMatch = responseText.match(/<front>([\s\S]*?)<\/front>/);
	if (frontMatch && frontMatch[1]) {
		result.front = frontMatch[1].trim();
	}

	// Extract back content
	const backMatch = responseText.match(/<back>([\s\S]*?)<\/back>/);
	if (backMatch && backMatch[1]) {
		result.back = backMatch[1].trim();
	}

	// Extract note content (optional)
	const noteMatch = responseText.match(/<note>([\s\S]*?)<\/note>/);
	if (noteMatch && noteMatch[1]) {
		result.note = noteMatch[1].trim();
	}

	// Extract priority
	const priorityMatch = responseText.match(/<priority>([ABC])<\/priority>/);
	if (priorityMatch && priorityMatch[1]) {
		// Convert string priority to enum
		switch (priorityMatch[1]) {
			case 'A':
				result.priority = Priority.A;
				break;
			case 'B':
				result.priority = Priority.B;
				break;
			case 'C':
				result.priority = Priority.C;
				break;
			default:
				result.priority = Priority.B; // Default to medium priority
		}
	}

	// Extract tags
	const tagsMatch = responseText.match(/<tags>([\s\S]*?)<\/tags>/);
	if (tagsMatch && tagsMatch[1]) {
		// Split by comma and trim each tag
		result.tags = tagsMatch[1]
			.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);
	} else {
		result.tags = [];
	}

	// Extract message (for refinement responses)
	const messageMatch = responseText.match(/<message>([\s\S]*?)<\/message>/);
	if (messageMatch && messageMatch[1]) {
		result.message = messageMatch[1].trim();
	}

	return result;
}

/**
 * Validate card data to ensure all required fields are present
 * @param cardData Parsed card data
 * @returns Whether the card data is valid
 */
export function validateCardData(cardData: ParsedCardResponse): boolean {
	return !!(
		cardData.front &&
		cardData.front.trim() !== '' &&
		cardData.back &&
		cardData.back.trim() !== ''
	);
}

/**
 * Generate a system prompt for card creation
 * @param topicName The name of the topic for context
 * @returns System prompt string
 */
export function generateCardCreationSystemPrompt(topicName: string): string {
	return CARD_CREATION_SYSTEM_PROMPT.replace('{{TOPIC_NAME}}', topicName);
}

/**
 * Format a prompt for refining existing card content
 * @param currentCard Current card data
 * @param refinementInstruction User's instructions for refinement
 * @returns Formatted refinement prompt string
 */
export function formatRefinementPrompt(
	currentCard: {
		front: string;
		back: string;
		note?: string | null;
	},
	refinementInstruction: string
): string {
	return CARD_REFINEMENT_PROMPT.replace('{{FRONT}}', currentCard.front)
		.replace('{{BACK}}', currentCard.back)
		.replace('{{NOTE}}', currentCard.note ? `Note: ${currentCard.note}` : '')
		.replace('{{REFINEMENT_INSTRUCTION}}', refinementInstruction);
}
