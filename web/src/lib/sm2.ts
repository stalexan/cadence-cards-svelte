import type { Card as PrismaCard } from '@prisma/client';

/**
 * Implementation of the spaced repetition algorithm. This algorithm is based
 * on the the SuperMemo 2 (SM-2) algorithm developed by Piotr Woźniak.
 * Source: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 */

/**
 * Type representing the minimal database card structure needed for scheduling
 */
export interface DbCard {
	id: number;
	front: string;
	back: string;
	note: string | null;
	lastSeen: Date | null;
	priority: string;
	grade: string | null;
	repCount: number;
	easiness: number;
	interval: number;
	deckId: number;
	deck?: {
		id: number;
		name: string;
	};
}

/**
 * Type representing the structure of priority counts for due cards
 */
export interface DueCardCounts {
	total: number;
	priorityA: number;
	priorityB: number;
	priorityC: number;
}

// Grade constants aligned with the database schema
export enum Grade {
	INCORRECT = 'INCORRECT',
	CORRECT_WITH_HESITATION = 'CORRECT_WITH_HESITATION',
	CORRECT_PERFECT_RECALL = 'CORRECT_PERFECT_RECALL'
}

// Priority levels for cards
export enum Priority {
	A = 'A', // High priority
	B = 'B', // Medium priority
	C = 'C' // Low priority
}

// Interface for card scheduling data (legacy - for cards with embedded SM-2 data)
export interface CardSchedulingData {
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
	lastSeen: Date | null;
	priority: Priority;
}

// Interface for schedule-based scheduling data (new - separate Schedule table)
export interface ScheduleData {
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
	lastSeen: Date | null;
}

/**
 * Interface for tracking original card state when first shown in a repetition
 */
export interface CardState {
	lastSeen: Date | null;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
}

/**
 * Initial SM-2 parameters for a new card (never studied)
 */
export const INITIAL_SM2_STATE = {
	repCount: 0,
	easiness: 2.5,
	interval: 1,
	grade: null as Grade | null,
	lastSeen: null as Date | null
} as const;

/**
 * Get the initial SM-2 state for a new card
 * @returns Initial SM-2 parameters
 */
export function getInitialSm2State() {
	return {
		repCount: INITIAL_SM2_STATE.repCount,
		easiness: INITIAL_SM2_STATE.easiness,
		interval: INITIAL_SM2_STATE.interval,
		grade: INITIAL_SM2_STATE.grade,
		lastSeen: INITIAL_SM2_STATE.lastSeen
	};
}

/**
 * Calculate days between two dates, ignoring time of day
 * @param date1 First date
 * @param date2 Second date
 * @returns Number of days between the dates
 */
export function getDaysBetweenDates(date1: Date, date2: Date): number {
	// Create date objects at midnight local time by extracting date components
	// This ensures we get a clean midnight in the local timezone
	const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
	const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());

	// Calculate difference in days
	return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days since a card was last seen
 * @param lastSeen Date when card was last seen (or null if never seen)
 * @returns Number of days since card was last seen, or Infinity if never seen
 */
export function getDaysSinceLastSeen(lastSeen: Date | null): number {
	if (!lastSeen) {
		return Infinity; // Card has never been seen
	}

	const today = new Date();
	return getDaysBetweenDates(lastSeen, today);
}

/**
 * Calculate the next interval and update card scheduling data based on SM-2 algorithm
 *
 * @param originalState The original card state when first shown in this repetition
 * @param newGrade The grade for the current repetition
 * @returns Updated card scheduling data
 */
export function calculateNextInterval(originalState: CardState, newGrade: Grade): CardState {
	const { repCount, easiness, interval } = originalState;

	// Copy the current card data
	const updatedCard: CardState = { ...originalState };

	// Update the grade
	updatedCard.grade = newGrade;

	// Update last seen to current date
	updatedCard.lastSeen = new Date();

	// Calculate new easiness factor (EF) based on SM-2 formula
	let quality = 0;
	switch (newGrade) {
		case Grade.CORRECT_PERFECT_RECALL:
			quality = 5;
			break;
		case Grade.CORRECT_WITH_HESITATION:
			quality = 4;
			break;
		case Grade.INCORRECT:
			quality = 0; // Using 0 for complete blackout/failure to recall
			break;
	}

	// Standard SM-2 formula: EF' = EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
	const newEasiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

	// Update the easiness factor, with 1.3 as min.
	updatedCard.easiness = Math.max(1.3, newEasiness);

	// Calculate the new interval based on SM-2 algorithm
	let newInterval: number;
	let newRepCount: number;

	// If the answer was incorrect, reset the interval to 1 day
	if (newGrade === Grade.INCORRECT) {
		newInterval = 1;
		// Reset repetition count for incorrect answers
		newRepCount = 0;
	} else {
		// For correct answers, increment repetition count
		newRepCount = repCount + 1;

		// Calculate interval based on repetition count and easiness
		if (newRepCount === 1) {
			newInterval = 1;
		} else if (newRepCount === 2) {
			newInterval = 6;
		} else {
			// For repetitions > 2, use the SM-2 formula
			newInterval = Math.round(interval * updatedCard.easiness);
		}
	}

	// Update the repetition count
	updatedCard.repCount = newRepCount;

	// Update the interval (minimum 1 day)
	updatedCard.interval = Math.max(1, newInterval);

	return updatedCard;
}

/**
 * Check if a card is due for review based on its scheduling data
 *
 * @param card The card scheduling data
 * @returns Whether the card is due for review
 */
export function isCardDue(card: CardSchedulingData): boolean {
	if (!card.lastSeen) {
		// If card has never been seen, it's due
		return true;
	}

	// Calculate days since last seen using the centralized function
	const daysSinceLastSeen = getDaysSinceLastSeen(card.lastSeen);

	// Card is due if days since last seen is greater than or equal to interval
	return daysSinceLastSeen >= card.interval;
}

/**
 * Check if a schedule is due for review based on its scheduling data
 * This is the preferred function for the new Schedule-based model
 *
 * @param schedule The schedule data
 * @returns Whether the schedule is due for review
 */
export function isScheduleDue(schedule: ScheduleData): boolean {
	if (!schedule.lastSeen) {
		// If schedule has never been seen, it's due
		return true;
	}

	// Calculate days since last seen using the centralized function
	const daysSinceLastSeen = getDaysSinceLastSeen(schedule.lastSeen);

	// Schedule is due if days since last seen is greater than or equal to interval
	return daysSinceLastSeen >= schedule.interval;
}

/**
 * Filter an array of cards to get only the ones that are due
 *
 * @param cards Array of card scheduling data
 * @returns Array of cards that are due for review
 */
export function getDueCards(cards: CardSchedulingData[]): CardSchedulingData[] {
	return cards.filter(isCardDue);
}

/**
 * Get the next due date for a card
 *
 * @param card The card scheduling data
 * @returns Date when the card will be due next
 */
export function getNextDueDate(card: CardSchedulingData): Date {
	const lastSeen = card.lastSeen || new Date();
	const nextDue = new Date(lastSeen);
	nextDue.setDate(nextDue.getDate() + card.interval);
	return nextDue;
}

/**
 * Sort cards by priority and due date
 *
 * @param cards Array of card scheduling data
 * @returns Sorted array of cards
 */
export function sortCardsByPriorityAndDueDate(cards: CardSchedulingData[]): CardSchedulingData[] {
	return [...cards].sort((a, b) => {
		// First sort by priority (A > B > C)
		if (a.priority !== b.priority) {
			return a.priority.localeCompare(b.priority);
		}

		// Then sort by due date (earliest first)
		const aNextDue = getNextDueDate(a);
		const bNextDue = getNextDueDate(b);
		return aNextDue.getTime() - bNextDue.getTime();
	});
}

/**
 * Convert database card records to the CardSchedulingData format required by SM-2 algorithm
 *
 * @param cards - Array of card records from the database
 * @returns Array of cards in CardSchedulingData format
 */
export function convertDbCardsToSchedulingData<
	T extends Pick<DbCard, 'lastSeen' | 'interval' | 'grade' | 'priority' | 'repCount' | 'easiness'>
>(cards: T[]): CardSchedulingData[] {
	return cards.map((card) => ({
		lastSeen: card.lastSeen,
		interval: card.interval,
		grade: card.grade as Grade | null,
		priority: card.priority as Priority,
		repCount: card.repCount,
		easiness: card.easiness
	}));
}

/**
 * Get cards that are due for review, sorted by priority and due date
 *
 * @param cards - Array of card records from the database
 * @returns Array of due cards, sorted by priority and due date
 */
export function getDueSortedCards(cards: CardSchedulingData[]): CardSchedulingData[];
export function getDueSortedCards<T extends DbCard | PrismaCard>(cards: T[]): T[];
export function getDueSortedCards<T extends DbCard | PrismaCard | CardSchedulingData>(
	cards: T[]
): T[] {
	// Check if we need to convert to scheduling data format
	const isSchedulingData = (card: T): card is T & CardSchedulingData => {
		return (
			'priority' in card &&
			'lastSeen' in card &&
			'interval' in card &&
			'grade' in card &&
			'repCount' in card &&
			'easiness' in card
		);
	};

	const needsConversion = cards.length === 0 || !isSchedulingData(cards[0]);

	// Convert to scheduling data format if needed
	const schedulingData = needsConversion
		? convertDbCardsToSchedulingData(
				cards as Pick<
					DbCard,
					'lastSeen' | 'interval' | 'grade' | 'priority' | 'repCount' | 'easiness'
				>[]
			)
		: (cards as CardSchedulingData[]);

	// Filter due cards and get their indices
	const dueIndices = schedulingData
		.map((card, index) => ({ card, index }))
		.filter((item) => isCardDue(item.card))
		.map((item) => item.index);

	// Get the original cards and their scheduling data at those indices and sort them
	const dueCardsWithSchedule = dueIndices.map((index) => ({
		card: cards[index],
		schedule: schedulingData[index]
	}));

	// Sort cards based on priority and due date using scheduling data
	const sortedPairs = [...dueCardsWithSchedule].sort((a, b) => {
		// First sort by priority (A > B > C)
		const aPriority = a.schedule.priority as Priority;
		const bPriority = b.schedule.priority as Priority;
		if (aPriority !== bPriority) {
			return aPriority.localeCompare(bPriority);
		}

		// Then sort by due date using scheduling data
		const aLastSeen = a.schedule.lastSeen ? new Date(a.schedule.lastSeen) : new Date();
		const bLastSeen = b.schedule.lastSeen ? new Date(b.schedule.lastSeen) : new Date();

		const aNextDue = new Date(aLastSeen);
		aNextDue.setDate(aNextDue.getDate() + a.schedule.interval);

		const bNextDue = new Date(bLastSeen);
		bNextDue.setDate(bNextDue.getDate() + b.schedule.interval);

		return aNextDue.getTime() - bNextDue.getTime();
	});

	// Return only the cards
	return sortedPairs.map((pair) => pair.card);
}

/**
 * Count due cards by priority
 *
 * @param cards - Array of cards
 * @returns Object with counts by priority
 */
export function countDueCardsByPriority<
	T extends Pick<DbCard, 'lastSeen' | 'interval' | 'grade' | 'priority' | 'repCount' | 'easiness'>
>(cards: T[]): DueCardCounts {
	// Convert to scheduling data format
	const schedulingData = convertDbCardsToSchedulingData(cards);

	// Filter due cards
	const dueCards = schedulingData.filter(isCardDue);

	// Count by priority
	return {
		total: dueCards.length,
		priorityA: dueCards.filter((card) => card.priority === Priority.A).length,
		priorityB: dueCards.filter((card) => card.priority === Priority.B).length,
		priorityC: dueCards.filter((card) => card.priority === Priority.C).length
	};
}
