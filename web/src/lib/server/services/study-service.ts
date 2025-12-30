import { prisma } from '$lib/server/db';
import { Priority, Grade, isScheduleDue } from '$lib/sm2';
import { logger } from '$lib/server/logger';
import { getRequestContext } from '$lib/server/request-utils';
import type { StudyStats, StudyCard } from '$lib/types/domain';

/**
 * Parameters for study session queries
 */
export interface StudySessionParams {
	userId: number;
	topicId: number;
	deckIds?: number[];
}

// Re-export domain types for convenience
export type { StudyCard, StudyStats };

/**
 * Type for schedule with card and deck info from database query
 */
interface ScheduleWithCardAndDeck {
	id: number;
	cardId: number;
	isReversed: boolean;
	easiness: number;
	interval: number;
	repCount: number;
	grade: string | null;
	lastSeen: Date | null;
	version: number;
	card: {
		id: number;
		front: string;
		back: string;
		note: string | null;
		priority: string;
		tags: string[];
		deckId: number;
		deck: {
			id: number;
			name: string;
			field1Label: string | null;
			field2Label: string | null;
			isBidirectional: boolean;
		};
	};
}

/**
 * Service class for study-related business logic
 */
export class StudyService {
	/**
	 * Verify that a topic belongs to the user
	 */
	private async verifyTopicOwnership(topicId: number, userId: number): Promise<void> {
		const topic = await prisma.topic.findFirst({
			where: {
				id: topicId,
				userId
			}
		});

		if (!topic) {
			throw new Error('Topic not found or does not belong to the user');
		}
	}

	/**
	 * Get the next schedule due for study, prioritizing by priority level
	 * Returns null if no schedules are due
	 * Now queries Schedule table and resolves direction-aware content
	 */
	async getNextCard(params: StudySessionParams, request?: Request): Promise<StudyCard | null> {
		const { userId, topicId, deckIds = [] } = params;

		// Verify ownership
		await this.verifyTopicOwnership(topicId, userId);

		// Iterate through priorities (A → B → C)
		for (const priority of [Priority.A, Priority.B, Priority.C]) {
			const dueSchedules = await this.getDueSchedulesForPriority({
				userId,
				topicId,
				deckIds,
				priority
			});

			if (dueSchedules.length > 0) {
				// Randomly select one schedule from the due schedules
				const randomIndex = Math.floor(Math.random() * dueSchedules.length);
				const selectedSchedule = dueSchedules[randomIndex];

				// Log the selection
				if (request) {
					logger.info('Next card selected for study', {
						...getRequestContext(request, {
							userId,
							cardId: selectedSchedule.cardId,
							scheduleId: selectedSchedule.id,
							isReversed: selectedSchedule.isReversed,
							topicId,
							priority: selectedSchedule.card.priority,
							operation: 'next_card'
						})
					});
				} else {
					logger.info('Next card selected for study', {
						userId,
						cardId: selectedSchedule.cardId,
						scheduleId: selectedSchedule.id,
						isReversed: selectedSchedule.isReversed,
						topicId,
						priority: selectedSchedule.card.priority,
						operation: 'next_card'
					});
				}

				return this.formatStudyCard(selectedSchedule);
			}
		}

		return null;
	}

	/**
	 * Get all due schedules for a specific priority level
	 * Filters by deck's bidirectional setting
	 */
	private async getDueSchedulesForPriority(params: {
		userId: number;
		topicId: number;
		deckIds: number[];
		priority: Priority;
	}): Promise<ScheduleWithCardAndDeck[]> {
		const { userId, topicId, deckIds, priority } = params;

		// Query schedules with card and deck info
		const schedules = await prisma.schedule.findMany({
			where: {
				card: {
					priority,
					deck: {
						topicId,
						topic: {
							userId
						},
						...(deckIds.length > 0 ? { id: { in: deckIds } } : {})
					}
				}
			},
			include: {
				card: {
					include: {
						deck: {
							select: {
								id: true,
								name: true,
								field1Label: true,
								field2Label: true,
								isBidirectional: true
							}
						}
					}
				}
			}
		});

		// Filter to:
		// 1. Only include reverse schedules if deck is bidirectional
		// 2. Only include due schedules
		return schedules.filter((schedule) => {
			// Skip reverse schedules for non-bidirectional decks
			if (schedule.isReversed && !schedule.card.deck.isBidirectional) {
				return false;
			}

			// Check if schedule is due
			return isScheduleDue({
				lastSeen: schedule.lastSeen,
				interval: schedule.interval,
				grade: schedule.grade as Grade | null,
				repCount: schedule.repCount,
				easiness: schedule.easiness
			});
		});
	}

	/**
	 * Format a schedule for the study interface
	 * Resolves prompt/answer based on direction (isReversed)
	 */
	private formatStudyCard(schedule: ScheduleWithCardAndDeck): StudyCard {
		const { card, isReversed } = schedule;
		const deck = card.deck;

		// Get labels with fallbacks
		const field1Label = deck.field1Label ?? 'Front';
		const field2Label = deck.field2Label ?? 'Back';

		// Resolve prompt/answer based on direction
		const prompt = isReversed ? card.back : card.front;
		const answer = isReversed ? card.front : card.back;
		const promptLabel = isReversed ? field2Label : field1Label;
		const answerLabel = isReversed ? field1Label : field2Label;

		return {
			id: card.id,
			scheduleId: schedule.id,
			prompt,
			answer,
			promptLabel,
			answerLabel,
			note: card.note,
			priority: card.priority as Priority,
			isReversed,
			deckId: card.deckId,
			deckName: deck.name,
			lastSeen: schedule.lastSeen,
			grade: schedule.grade as Grade | null,
			repCount: schedule.repCount,
			easiness: schedule.easiness,
			interval: schedule.interval,
			tags: card.tags,
			version: schedule.version
		};
	}

	/**
	 * Get study statistics for a topic/deck selection
	 *
	 * Returns basic card counts and due statistics. Does NOT include:
	 * - Performance metrics (correctPercentage)
	 * - Easiness averages
	 * - Historical session data
	 *
	 * For enhanced analytics, see future EnhancedStudyStats endpoint.
	 *
	 * Now queries Schedule table and respects bidirectional settings.
	 * The count reflects the number of due study items (schedules), not cards.
	 *
	 * @param params - Topic and deck selection parameters
	 * @returns Basic study statistics
	 */
	async getStudyStats(params: StudySessionParams): Promise<StudyStats> {
		const { userId, topicId, deckIds = [] } = params;

		// Verify ownership
		await this.verifyTopicOwnership(topicId, userId);

		const baseWhereClause = {
			deck: {
				topicId,
				topic: {
					userId
				},
				...(deckIds.length > 0 ? { id: { in: deckIds } } : {})
			}
		};

		// Get total cards count
		const totalCards = await prisma.card.count({
			where: baseWhereClause
		});

		// Get all schedules with card and deck info to calculate due counts
		const allSchedules = await prisma.schedule.findMany({
			where: {
				card: baseWhereClause
			},
			select: {
				id: true,
				isReversed: true,
				lastSeen: true,
				interval: true,
				grade: true,
				repCount: true,
				easiness: true,
				card: {
					select: {
						priority: true,
						deck: {
							select: {
								isBidirectional: true
							}
						}
					}
				}
			}
		});

		// Calculate due schedules by priority
		const dueCards = {
			total: 0,
			priorityA: 0,
			priorityB: 0,
			priorityC: 0
		};

		for (const schedule of allSchedules) {
			// Skip reverse schedules for non-bidirectional decks
			if (schedule.isReversed && !schedule.card.deck.isBidirectional) {
				continue;
			}

			const isDue = isScheduleDue({
				lastSeen: schedule.lastSeen,
				interval: schedule.interval,
				grade: schedule.grade as Grade | null,
				repCount: schedule.repCount,
				easiness: schedule.easiness
			});

			if (isDue) {
				dueCards.total++;

				const priority = schedule.card.priority;
				if (priority === Priority.A) {
					dueCards.priorityA++;
				} else if (priority === Priority.B) {
					dueCards.priorityB++;
				} else if (priority === Priority.C) {
					dueCards.priorityC++;
				}
			}
		}

		return {
			totalCards,
			dueCards
		};
	}
}

// Export a singleton instance
export const studyService = new StudyService();
