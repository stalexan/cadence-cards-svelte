/**
 * Domain Type Definitions
 *
 * This file contains core business logic types that represent domain concepts
 * used throughout the application. These are the "source of truth" types that
 * other layers (API, database, study) should import from.
 *
 * DEPENDENCIES:
 *   - primitives.ts (Grade, Priority enums)
 *
 * IMPORTED BY:
 *   - api.ts (for API response types)
 *   - database.ts (for Prisma extensions)
 *   - study.ts (for study session types)
 *   - Various service and component files
 *
 * RULES:
 *   - Keep this file free of imports from other type files (database.ts, api.ts, study.ts)
 *   - Only import primitives/enums
 *   - Other type files should import from here, not vice versa
 */

import { Grade, Priority } from './primitives';

// Dashboard statistics
export interface DashboardStats {
	totalTopics: number;
	totalDecks: number;
	totalCards: number;
	cardsCorrect: number;
	cardsIncorrect: number;
	cardsDue: {
		priorityA: number;
		priorityB: number;
		priorityC: number;
	};
	recentActivity: {
		id: number;
		action: string;
		itemType: string;
		itemName: string;
		timestamp: string;
	}[];
}

// Study statistics
export interface StudyStats {
	totalCards: number;
	dueCards: {
		total: number;
		priorityA: number;
		priorityB: number;
		priorityC: number;
	};
}

/**
 * Study card for the study session
 * Now includes scheduleId for grading the specific direction
 * prompt/answer are pre-resolved based on isReversed
 */
export interface StudyCard {
	id: number; // Card ID
	scheduleId: number; // Schedule ID for grading the specific direction
	prompt: string; // Already resolved (front or back based on direction)
	answer: string; // Already resolved (back or front based on direction)
	promptLabel: string; // Label for prompt (e.g., "English" or "Spanish")
	answerLabel: string; // Label for answer (e.g., "Spanish" or "English")
	note: string | null;
	priority: Priority;
	isReversed: boolean; // Whether this is the reverse direction
	lastSeen: Date | null;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
	deckId: number;
	deckName: string;
	tags: string[];
	version: number; // For optimistic locking
}
