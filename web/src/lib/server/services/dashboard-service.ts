import { prisma } from '$lib/server/db';
import { isScheduleDue, Priority, Grade } from '$lib/sm2';
import type { DashboardStats } from '$lib/types/domain';

/**
 * Recent activity item (internal service type with additional fields)
 */
interface RecentActivityItem {
	id: number;
	action: string;
	itemType: string;
	itemName: string;
	deckName: string;
	timestamp: Date | null;
}

// Re-export for external use
export type { DashboardStats };

/**
 * Service class for dashboard-related business logic
 */
export class DashboardService {
	/**
	 * Get comprehensive dashboard statistics for a user
	 * Updated to use Schedule table for SM-2 data
	 */
	async getDashboardStats(userId: number): Promise<DashboardStats> {
		// Fetch topics count
		const topicsCount = await prisma.topic.count({
			where: {
				userId
			}
		});

		// Fetch decks count
		const decksCount = await prisma.deck.count({
			where: {
				topic: {
					userId
				}
			}
		});

		// Fetch total cards count
		const totalCards = await prisma.card.count({
			where: {
				deck: {
					topic: {
						userId
					}
				}
			}
		});

		// Fetch all schedules for counting correct/incorrect and due cards
		const schedules = await prisma.schedule.findMany({
			where: {
				card: {
					deck: {
						topic: {
							userId
						}
					}
				}
			},
			include: {
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

		// Calculate correct/incorrect from schedules (forward schedules only for consistency)
		const forwardSchedules = schedules.filter((s) => !s.isReversed);
		const cardsCorrect = forwardSchedules.filter(
			(s) => s.grade === 'CORRECT_PERFECT_RECALL' || s.grade === 'CORRECT_WITH_HESITATION'
		).length;
		const cardsIncorrect = forwardSchedules.filter((s) => s.grade === 'INCORRECT').length;

		// Count due schedules by priority (respecting bidirectional setting)
		const cardsDue = {
			priorityA: 0,
			priorityB: 0,
			priorityC: 0
		};

		for (const schedule of schedules) {
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
				const priority = schedule.card.priority;
				if (priority === Priority.A) {
					cardsDue.priorityA++;
				} else if (priority === Priority.B) {
					cardsDue.priorityB++;
				} else if (priority === Priority.C) {
					cardsDue.priorityC++;
				}
			}
		}

		// Get recent activity from schedules
		const recentSchedules = await prisma.schedule.findMany({
			where: {
				card: {
					deck: {
						topic: {
							userId
						}
					}
				},
				lastSeen: {
					not: null
				}
			},
			orderBy: {
				lastSeen: 'desc'
			},
			take: 5,
			include: {
				card: {
					select: {
						id: true,
						front: true,
						deck: {
							select: {
								name: true
							}
						}
					}
				}
			}
		});

		const recentActivity: RecentActivityItem[] = recentSchedules.map((schedule) => ({
			id: schedule.card.id,
			action: schedule.isReversed ? 'Reviewed card (reverse)' : 'Reviewed card',
			itemType: 'card',
			itemName:
				schedule.card.front.length > 30
					? schedule.card.front.substring(0, 30) + '...'
					: schedule.card.front,
			deckName: schedule.card.deck.name,
			timestamp: schedule.lastSeen
		}));

		// Compile the statistics and transform to domain type
		return {
			totalTopics: topicsCount,
			totalDecks: decksCount,
			totalCards,
			cardsCorrect,
			cardsIncorrect,
			cardsDue,
			recentActivity: recentActivity.map((item) => ({
				id: item.id,
				action: item.action,
				itemType: item.itemType,
				itemName: item.itemName,
				timestamp: item.timestamp?.toISOString() || new Date().toISOString()
			}))
		};
	}
}

// Export a singleton instance
export const dashboardService = new DashboardService();
