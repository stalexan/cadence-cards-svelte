import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { scheduleService } from '$lib/server/services';
import { Grade } from '$lib/sm2';
import { logger } from '$lib/server/logger';
import { getRequestContext } from '$lib/server/request-utils';

// Validation schema for recording a review (grading)
const recordReviewSchema = z.object({
	grade: z.enum([Grade.CORRECT_PERFECT_RECALL, Grade.CORRECT_WITH_HESITATION, Grade.INCORRECT]),
	version: z.number().int().min(0) // Required for optimistic locking
});

/**
 * GET /api/schedules/[id] - Get a specific schedule
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const scheduleId = parseInt(event.params.id, 10);

		if (isNaN(scheduleId)) {
			return json({ message: 'Invalid schedule ID' }, { status: 400 });
		}

		const schedule = await scheduleService.getScheduleById(scheduleId, userId);
		return json(schedule);
	} catch (err) {
		return handleApiError(err, { operation: 'fetch_schedule' });
	}
};

/**
 * PUT /api/schedules/[id] - Record a review for a schedule (grade it)
 * This is the main endpoint for study session grading
 */
export const PUT: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const scheduleId = parseInt(event.params.id, 10);
		const body = await event.request.json();

		if (isNaN(scheduleId)) {
			return json({ message: 'Invalid schedule ID' }, { status: 400 });
		}

		const reviewData = recordReviewSchema.parse(body);

		let updatedSchedule;
		try {
			updatedSchedule = await scheduleService.recordReview({
				scheduleId,
				userId,
				grade: reviewData.grade,
				currentVersion: reviewData.version
			});
		} catch (error: unknown) {
			// Handle version conflict (optimistic locking failure)
			if (
				error instanceof Error &&
				(error as Error & { code?: string }).code === 'VERSION_CONFLICT'
			) {
				logger.warn('Optimistic lock conflict - schedule was modified concurrently', {
					...getRequestContext(event.request, {
						userId,
						scheduleId,
						providedVersion: reviewData.version,
						operation: 'record_review_version_conflict'
					})
				});
				return json(
					{
						message: (error as Error).message,
						code: 'VERSION_CONFLICT'
					},
					{ status: 409 }
				);
			}
			throw error;
		}

		logger.audit('Schedule graded', {
			...getRequestContext(event.request, {
				userId,
				scheduleId,
				grade: reviewData.grade,
				newInterval: updatedSchedule.interval,
				newRepCount: updatedSchedule.repCount,
				operation: 'record_review'
			})
		});

		return json(updatedSchedule);
	} catch (err) {
		return handleApiError(err, { operation: 'record_review' });
	}
};

/**
 * DELETE /api/schedules/[id] - Reset a schedule's progress
 * Note: Using DELETE semantically represents "deleting" the progress
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const scheduleId = parseInt(event.params.id, 10);

		if (isNaN(scheduleId)) {
			return json({ message: 'Invalid schedule ID' }, { status: 400 });
		}

		const resetSchedule = await scheduleService.resetProgress(scheduleId, userId);

		logger.audit('Schedule progress reset', {
			...getRequestContext(event.request, {
				userId,
				scheduleId,
				operation: 'reset_progress'
			})
		});

		return json(resetSchedule);
	} catch (err) {
		return handleApiError(err, { operation: 'reset_progress' });
	}
};
