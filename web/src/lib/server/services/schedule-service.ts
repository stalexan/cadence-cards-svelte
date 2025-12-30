import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';
import { Grade, calculateNextInterval, type CardState } from '$lib/sm2';

/**
 * Parameters for recording a review
 */
export interface RecordReviewParams {
	scheduleId: number;
	userId: number;
	grade: Grade;
	currentVersion: number;
}

/**
 * Formatted schedule response with card info
 */
export interface FormattedSchedule {
	id: number;
	cardId: number;
	isReversed: boolean;
	easiness: number;
	interval: number;
	repCount: number;
	grade: Grade | null;
	lastSeen: Date | null;
	version: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Service class for schedule-related business logic
 * Handles SM-2 scheduling updates for study sessions
 */
export class ScheduleService {
	/**
	 * Record a review for a schedule
	 * Uses optimistic locking to prevent lost updates
	 */
	async recordReview(params: RecordReviewParams): Promise<FormattedSchedule> {
		const { scheduleId, userId, grade, currentVersion } = params;

		try {
			const updatedSchedule = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
				// Verify ownership and get current schedule
				const schedule = await tx.schedule.findFirst({
					where: {
						id: scheduleId,
						card: {
							deck: {
								topic: {
									userId
								}
							}
						}
					}
				});

				if (!schedule) {
					throw new Error('Schedule not found or does not belong to the user');
				}

				// Optimistic locking check
				if (schedule.version !== currentVersion) {
					const versionError: Error & { code?: string } = new Error(
						'Schedule was modified by another request. Please refresh and try again.'
					);
					versionError.code = 'VERSION_CONFLICT';
					throw versionError;
				}

				// Calculate new SM-2 parameters based on original state
				const originalState: CardState = {
					lastSeen: schedule.lastSeen,
					grade: schedule.grade as Grade | null,
					repCount: schedule.repCount,
					easiness: schedule.easiness,
					interval: schedule.interval
				};

				const updatedState = calculateNextInterval(originalState, grade);

				// Update the schedule
				return await tx.schedule.update({
					where: { id: scheduleId },
					data: {
						easiness: updatedState.easiness,
						interval: updatedState.interval,
						repCount: updatedState.repCount,
						grade: grade,
						lastSeen: new Date(),
						version: { increment: 1 }
					}
				});
			});

			return this.formatSchedule(updatedSchedule);
		} catch (error: unknown) {
			// Handle version conflict (optimistic locking failure)
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
				const versionError: Error & { code?: string } = new Error(
					'This schedule was modified by another request. Please refresh and try again.'
				);
				versionError.code = 'VERSION_CONFLICT';
				throw versionError;
			}
			throw error;
		}
	}

	/**
	 * Get a schedule by ID with ownership verification
	 */
	async getScheduleById(scheduleId: number, userId: number): Promise<FormattedSchedule> {
		const schedule = await prisma.schedule.findFirst({
			where: {
				id: scheduleId,
				card: {
					deck: {
						topic: {
							userId
						}
					}
				}
			}
		});

		if (!schedule) {
			throw new Error('Schedule not found or does not belong to the user');
		}

		return this.formatSchedule(schedule);
	}

	/**
	 * Format a schedule for the API response
	 */
	private formatSchedule(schedule: {
		id: number;
		cardId: number;
		isReversed: boolean;
		easiness: number;
		interval: number;
		repCount: number;
		grade: string | null;
		lastSeen: Date | null;
		version: number;
		createdAt: Date;
		updatedAt: Date;
	}): FormattedSchedule {
		return {
			id: schedule.id,
			cardId: schedule.cardId,
			isReversed: schedule.isReversed,
			easiness: schedule.easiness,
			interval: schedule.interval,
			repCount: schedule.repCount,
			grade: schedule.grade as Grade | null,
			lastSeen: schedule.lastSeen,
			version: schedule.version,
			createdAt: schedule.createdAt,
			updatedAt: schedule.updatedAt
		};
	}

	/**
	 * Reset a schedule's progress (SM-2 parameters back to initial state)
	 */
	async resetProgress(scheduleId: number, userId: number): Promise<FormattedSchedule> {
		const schedule = await prisma.schedule.findFirst({
			where: {
				id: scheduleId,
				card: {
					deck: {
						topic: {
							userId
						}
					}
				}
			}
		});

		if (!schedule) {
			throw new Error('Schedule not found or does not belong to the user');
		}

		const updatedSchedule = await prisma.schedule.update({
			where: { id: scheduleId },
			data: {
				easiness: 2.5,
				interval: 1,
				repCount: 0,
				grade: null,
				lastSeen: null,
				version: { increment: 1 }
			}
		});

		return this.formatSchedule(updatedSchedule);
	}
}

// Export a singleton instance
export const scheduleService = new ScheduleService();
