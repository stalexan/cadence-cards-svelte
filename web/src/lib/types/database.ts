/**
 * Database Type Definitions
 *
 * This file contains Prisma-related types for database models and their relations.
 * It extends Prisma's base types with relationship information and provides
 * convenience types for common query patterns.
 *
 * DEPENDENCIES:
 *   - @prisma/client (Prisma generated types)
 *   - primitives.ts (Grade)
 *
 * IMPORTED BY:
 *   - Service layer files (for database operations)
 *   - API route handlers (for database queries)
 *
 * RULES:
 *   - Do NOT re-export domain types here (import from domain.ts directly instead)
 *   - Only define database-specific extensions (types with relations)
 *   - Import from domain.ts if you need domain types, don't duplicate them
 */

import type { User, Topic, Deck, Card, Schedule, Prisma } from '@prisma/client';
import type { Grade } from './primitives';

// Re-export the base Prisma types for convenience
export type { User, Topic, Deck, Card, Schedule };

// Extended types with relations (for when you need related entities)

export interface TopicWithDecks extends Topic {
	decks: Deck[];
	deckCount?: number;
	cardCount?: number;
}

export interface DeckWithCards extends Deck {
	cards: Card[];
	topic?: Topic;
	cardCount?: number;
}

export interface DeckWithTopic extends Deck {
	topic: Topic;
}

/**
 * Card with deck relation and SM-2 schedule data
 * SM-2 fields come from the forward schedule for backwards compatibility
 */
export interface CardWithDeck extends Card {
	deck: Deck;
	// SM-2 fields from forward schedule (for backwards compatibility)
	lastSeen: Date | null;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
}

/**
 * Card with deck, topic, and SM-2 schedule data
 * SM-2 fields come from the forward schedule for backwards compatibility
 */
export interface CardWithDeckAndTopic extends Card {
	deck: DeckWithTopic;
	// SM-2 fields from forward schedule (for backwards compatibility)
	lastSeen: Date | null;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
}

/**
 * Card with full schedule array for bidirectional display
 */
export interface CardWithSchedules extends Card {
	deck: DeckWithTopic;
	schedules: Schedule[];
}

// Original state for SM2 calculation tracking
export interface OriginalCardState {
	lastSeen: Date | null;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
}

// Input types for creating and updating records
export type CreateTopicInput = Prisma.TopicCreateInput;
export type UpdateTopicInput = Prisma.TopicUpdateInput;

export type CreateDeckInput = Prisma.DeckCreateInput;
export type UpdateDeckInput = Prisma.DeckUpdateInput;

export type CreateCardInput = Prisma.CardCreateInput;
export type UpdateCardInput = Prisma.CardUpdateInput;
