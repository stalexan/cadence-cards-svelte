import { stringify, parse } from 'yaml';
import { z } from 'zod';
import { Priority, Grade, INITIAL_SM2_STATE } from './sm2';

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
	// SM-2 easiness has a 1.3 floor but no upper bound — repeated perfect recall pushes it
	// above the 2.5 starting value (see Math.max(1.3, ...) in sm2.ts). Capping it here would
	// reject exported well-practiced cards on re-import.
	Easiness: z.number().min(1.3).optional().default(2.5),
	Interval: z.number().int().min(1).optional().default(1),
	Tags: z.array(z.string()).optional().default([]),
	// Reverse schedule parameters (for bidirectional decks).
	// Unlike the forward fields these carry no `.default()`: a forward schedule always exists, but a
	// reverse one only exists for bidirectional decks. Defaulting here would make "absent from the
	// YAML" indistinguishable from "present with starting values", and the import path needs that
	// distinction to decide whether to create a reverse Schedule row at all.
	ReverseLastSeen: z.string().nullable().optional(),
	ReverseGrade: z
		.enum([Grade.CORRECT_PERFECT_RECALL, Grade.CORRECT_WITH_HESITATION, Grade.INCORRECT])
		.nullable()
		.optional(),
	ReverseRepCount: z.number().int().min(0).optional(),
	ReverseEasiness: z.number().min(1.3).optional(),
	ReverseInterval: z.number().int().min(1).optional()
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

/**
 * A card as returned by the card service, with its per-direction schedules.
 * Declared structurally so this module stays free of any `$lib/server` import.
 */
export type CardWithSchedules = {
	front: string;
	back: string;
	note: string | null;
	priority: Priority;
	tags: string[];
	schedules: {
		isReversed: boolean;
		lastSeen: Date | null;
		grade: Grade | null;
		repCount: number;
		easiness: number;
		interval: number;
	}[];
};

/**
 * Flatten service-shaped cards into the `DatabaseCard` shape the exporter consumes.
 *
 * The two shapes are structurally assignable, so passing service cards straight to
 * `exportCardsToYaml` typechecks — but silently drops every reverse-direction schedule, since the
 * `reverse*` keys simply never exist. Going through this adapter makes the mapping explicit and
 * unit-testable.
 */
export function toDatabaseCards(cards: CardWithSchedules[]): DatabaseCard[] {
	return cards.map((card) => {
		const forward = card.schedules.find((s) => !s.isReversed);
		const reverse = card.schedules.find((s) => s.isReversed);

		const dbCard: DatabaseCard = {
			front: card.front,
			back: card.back,
			note: card.note,
			priority: card.priority,
			tags: card.tags,
			lastSeen: forward?.lastSeen ?? INITIAL_SM2_STATE.lastSeen,
			grade: forward?.grade ?? INITIAL_SM2_STATE.grade,
			repCount: forward?.repCount ?? INITIAL_SM2_STATE.repCount,
			easiness: forward?.easiness ?? INITIAL_SM2_STATE.easiness,
			interval: forward?.interval ?? INITIAL_SM2_STATE.interval
		};

		// Only attach reverse keys when a reverse schedule actually exists — their presence is what
		// tells the exporter (and later the importer) that this card has a second direction.
		if (reverse) {
			dbCard.reverseLastSeen = reverse.lastSeen;
			dbCard.reverseGrade = reverse.grade;
			dbCard.reverseRepCount = reverse.repCount;
			dbCard.reverseEasiness = reverse.easiness;
			dbCard.reverseInterval = reverse.interval;
		}

		return dbCard;
	});
}

/** True when the card carries reverse-direction SM-2 data. */
function hasReverseSm2(card: DatabaseCard): boolean {
	return (
		card.reverseLastSeen !== undefined ||
		card.reverseGrade !== undefined ||
		card.reverseRepCount !== undefined ||
		card.reverseEasiness !== undefined ||
		card.reverseInterval !== undefined
	);
}

// Metadata for YAML export
export interface ExportMetadata {
	formatVersion: string;
	deckName: string;
	creatorName: string | null;
	exportDate: string;
	cardCount: number;
	isBidirectional: boolean;
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
			if (hasReverseSm2(card)) {
				cardWithSm2.ReverseLastSeen = card.reverseLastSeen
					? new Date(card.reverseLastSeen).toISOString().split('T')[0]
					: null;
				cardWithSm2.ReverseGrade = card.reverseGrade ?? INITIAL_SM2_STATE.grade;
				cardWithSm2.ReverseRepCount = card.reverseRepCount ?? INITIAL_SM2_STATE.repCount;
				cardWithSm2.ReverseEasiness = card.reverseEasiness ?? INITIAL_SM2_STATE.easiness;
				cardWithSm2.ReverseInterval = card.reverseInterval ?? INITIAL_SM2_STATE.interval;
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
# Bidirectional: ${metadata.isBidirectional ? 'Yes' : 'No'}
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
			`Error parsing YAML: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error }
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

		// Include reverse schedule data if present (for bidirectional decks).
		// Fallbacks are resolved here rather than at the call site so the import service only has to
		// ask "are the reverse keys present?" — it runs in a transaction and can't be unit tested.
		const hasReverseData =
			card.ReverseLastSeen !== undefined ||
			card.ReverseGrade !== undefined ||
			card.ReverseRepCount !== undefined ||
			card.ReverseEasiness !== undefined ||
			card.ReverseInterval !== undefined;

		if (hasReverseData) {
			return {
				...baseCard,
				reverseLastSeen: card.ReverseLastSeen ? new Date(card.ReverseLastSeen) : null,
				reverseGrade: card.ReverseGrade ?? INITIAL_SM2_STATE.grade,
				reverseRepCount: card.ReverseRepCount ?? INITIAL_SM2_STATE.repCount,
				reverseEasiness: card.ReverseEasiness ?? INITIAL_SM2_STATE.easiness,
				reverseInterval: card.ReverseInterval ?? INITIAL_SM2_STATE.interval
			};
		}

		return baseCard;
	});
}
