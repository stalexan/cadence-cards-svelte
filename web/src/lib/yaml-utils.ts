import { stringify, parse } from 'yaml';
import { z } from 'zod';
import { Priority, Grade } from './sm2';

// Validation schema for a card in YAML format
export const YamlCardSchema = z.object({
	ID: z.number().int().optional(),
	Front: z.string().min(1, 'Front content is required'),
	Back: z.string().min(1, 'Back content is required'),
	Note: z.string().nullable().optional(),
	LastSeen: z.string().nullable().optional(),
	Priority: z.enum([Priority.A, Priority.B, Priority.C]),
	Grade: z
		.enum([Grade.CORRECT_PERFECT_RECALL, Grade.CORRECT_WITH_HESITATION, Grade.INCORRECT])
		.nullable()
		.optional(),
	RepCount: z.number().int().min(0).optional().default(0),
	Easiness: z.number().min(1.3).max(2.5).optional().default(2.5),
	Interval: z.number().int().min(1).optional().default(1),
	Tags: z.array(z.string()).optional().default([]),
	// Reverse schedule parameters (for bidirectional decks)
	ReverseLastSeen: z.string().nullable().optional(),
	ReverseGrade: z
		.enum([Grade.CORRECT_PERFECT_RECALL, Grade.CORRECT_WITH_HESITATION, Grade.INCORRECT])
		.nullable()
		.optional(),
	ReverseRepCount: z.number().int().min(0).optional().default(0),
	ReverseEasiness: z.number().min(1.3).max(2.5).optional().default(2.5),
	ReverseInterval: z.number().int().min(1).optional().default(1)
});

export type YamlCard = z.infer<typeof YamlCardSchema>;

// Database card type
export type DatabaseCard = {
	front: string;
	back: string;
	note: string | null;
	lastSeen: Date | string | null;
	priority: Priority;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
	tags: string[];
	// Reverse schedule data (optional, for bidirectional decks)
	reverseLastSeen?: Date | string | null;
	reverseGrade?: Grade | null;
	reverseRepCount?: number;
	reverseEasiness?: number;
	reverseInterval?: number;
};

// Metadata for YAML export
export interface ExportMetadata {
	formatVersion: string;
	deckName: string;
	creatorName: string | null;
	exportDate: string;
	cardCount: number;
}

// Export cards to YAML format
export function exportCardsToYaml(
	cards: DatabaseCard[],
	metadata?: ExportMetadata,
	includeSm2Params: boolean = false
): string {
	// Transform database cards to YAML format
	const yamlCards = cards.map((card, index) => {
		const baseCard = {
			ID: index + 1, // Use sequential IDs for export
			Front: card.front,
			Back: card.back,
			Note: card.note,
			Priority: card.priority,
			Tags: card.tags
		};

		// Only include SM-2 parameters if explicitly requested
		if (includeSm2Params) {
			const cardWithSm2: Record<string, unknown> = {
				...baseCard,
				LastSeen: card.lastSeen ? new Date(card.lastSeen).toISOString().split('T')[0] : null,
				Grade: card.grade,
				RepCount: card.repCount,
				Easiness: card.easiness,
				Interval: card.interval
			};

			// Include reverse schedule parameters if present (for bidirectional decks)
			if (card.reverseLastSeen !== undefined || card.reverseGrade !== undefined) {
				cardWithSm2.ReverseLastSeen = card.reverseLastSeen
					? new Date(card.reverseLastSeen).toISOString().split('T')[0]
					: null;
				cardWithSm2.ReverseGrade = card.reverseGrade ?? null;
				cardWithSm2.ReverseRepCount = card.reverseRepCount ?? 0;
				cardWithSm2.ReverseEasiness = card.reverseEasiness ?? 2.5;
				cardWithSm2.ReverseInterval = card.reverseInterval ?? 1;
			}

			return cardWithSm2;
		}

		return baseCard;
	});

	const yamlContent = stringify(yamlCards, {
		indent: 2,
		lineWidth: 0 // Disable line wrapping
	});

	// Add metadata header if provided
	if (metadata) {
		const header = `# ============================================
# Flashcard Deck Export
# ============================================
# Format Version: ${metadata.formatVersion}
# Deck: ${metadata.deckName}
# Creator: ${metadata.creatorName || 'Anonymous'}
# Exported: ${metadata.exportDate}
# Cards: ${metadata.cardCount}
# ============================================

`;
		return header + yamlContent;
	}

	return yamlContent;
}

// Import cards from YAML format
// Handles YAML with or without metadata comments
export function importCardsFromYaml(yamlContent: string): {
	valid: YamlCard[];
	invalid: { card: unknown; error: string }[];
} {
	try {
		// Parse YAML (comments are automatically ignored by the yaml library)
		const parsedContent = parse(yamlContent);

		if (!Array.isArray(parsedContent)) {
			throw new Error('YAML content must be an array of cards');
		}

		const validCards: YamlCard[] = [];
		const invalidCards: { card: unknown; error: string }[] = [];

		parsedContent.forEach((card, index) => {
			try {
				const validatedCard = YamlCardSchema.parse(card);
				validCards.push(validatedCard);
			} catch (error: unknown) {
				invalidCards.push({
					card,
					error: `Card at index ${index}: ${error instanceof Error ? error.message : String(error)}`
				});
			}
		});

		return { valid: validCards, invalid: invalidCards };
	} catch (error: unknown) {
		throw new Error(
			`Error parsing YAML: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// Convert YAML cards to database format
export function convertYamlCardsToDatabaseFormat(yamlCards: YamlCard[], deckId: number) {
	return yamlCards.map((card) => {
		const baseCard = {
			front: card.Front,
			back: card.Back,
			note: card.Note,
			lastSeen: card.LastSeen ? new Date(card.LastSeen) : null,
			priority: card.Priority,
			grade: card.Grade,
			repCount: card.RepCount,
			easiness: card.Easiness,
			interval: card.Interval,
			tags: card.Tags,
			deckId
		};

		// Include reverse schedule data if present (for bidirectional decks)
		const hasReverseData =
			card.ReverseLastSeen !== undefined ||
			card.ReverseGrade !== undefined ||
			card.ReverseRepCount !== undefined;

		if (hasReverseData) {
			return {
				...baseCard,
				reverseLastSeen: card.ReverseLastSeen ? new Date(card.ReverseLastSeen) : null,
				reverseGrade: card.ReverseGrade,
				reverseRepCount: card.ReverseRepCount,
				reverseEasiness: card.ReverseEasiness,
				reverseInterval: card.ReverseInterval
			};
		}

		return baseCard;
	});
}
