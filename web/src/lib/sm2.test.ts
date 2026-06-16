import { describe, it, expect } from 'vitest';
import {
	Grade,
	Priority,
	calculateNextInterval,
	getDaysBetweenDates,
	getDaysSinceLastSeen,
	isCardDue,
	isScheduleDue,
	sortCardsByPriorityAndDueDate,
	countDueCardsByPriority,
	type CardState,
	type CardSchedulingData
} from './sm2';

/**
 * Build a date that is exactly `days` whole days before today (local midnight).
 * Used to drive the day-based due-date logic deterministically.
 */
function daysAgo(days: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d;
}

describe('calculateNextInterval', () => {
	const base: CardState = {
		lastSeen: null,
		grade: null,
		repCount: 0,
		easiness: 2.5,
		interval: 1
	};

	it('resets interval and repCount and drops easiness on INCORRECT', () => {
		const result = calculateNextInterval({ ...base, repCount: 4, interval: 30 }, Grade.INCORRECT);
		expect(result.interval).toBe(1);
		expect(result.repCount).toBe(0);
		expect(result.grade).toBe(Grade.INCORRECT);
		// quality 0: EF delta is -0.8 -> 2.5 - 0.8 = 1.7
		expect(result.easiness).toBeCloseTo(1.7, 5);
	});

	it('never lets easiness fall below the 1.3 floor', () => {
		// Two consecutive INCORRECT grades would push EF to 0.9 without the clamp.
		let state: CardState = { ...base };
		state = calculateNextInterval(state, Grade.INCORRECT); // 1.7
		state = calculateNextInterval({ ...state, easiness: state.easiness }, Grade.INCORRECT); // 0.9 -> clamp
		expect(state.easiness).toBe(1.3);
	});

	it('treats CORRECT_WITH_HESITATION (quality 4) as the neutral easiness point', () => {
		const result = calculateNextInterval(base, Grade.CORRECT_WITH_HESITATION);
		expect(result.easiness).toBeCloseTo(2.5, 5);
		expect(result.repCount).toBe(1);
	});

	it('raises easiness on CORRECT_PERFECT_RECALL (quality 5)', () => {
		const result = calculateNextInterval(base, Grade.CORRECT_PERFECT_RECALL);
		expect(result.easiness).toBeCloseTo(2.6, 5);
	});

	it('follows the SM-2 interval progression for correct answers', () => {
		// First correct rep -> interval 1
		const first = calculateNextInterval(base, Grade.CORRECT_PERFECT_RECALL);
		expect(first.repCount).toBe(1);
		expect(first.interval).toBe(1);

		// Second correct rep -> interval 6
		const second = calculateNextInterval(
			{ ...base, repCount: 1, interval: 1 },
			Grade.CORRECT_PERFECT_RECALL
		);
		expect(second.repCount).toBe(2);
		expect(second.interval).toBe(6);

		// Third+ correct rep -> round(interval * newEasiness); EF 2.5 -> 2.6, 6 * 2.6 = 15.6 -> 16
		const third = calculateNextInterval(
			{ ...base, repCount: 2, interval: 6 },
			Grade.CORRECT_PERFECT_RECALL
		);
		expect(third.repCount).toBe(3);
		expect(third.interval).toBe(16);
	});

	it('stamps lastSeen with a Date', () => {
		const result = calculateNextInterval(base, Grade.CORRECT_PERFECT_RECALL);
		expect(result.lastSeen).toBeInstanceOf(Date);
	});
});

describe('getDaysBetweenDates', () => {
	it('returns 0 for the same calendar day regardless of time', () => {
		const morning = new Date(2024, 0, 15, 8, 0, 0);
		const evening = new Date(2024, 0, 15, 23, 0, 0);
		expect(getDaysBetweenDates(morning, evening)).toBe(0);
	});

	it('returns 1 for consecutive days', () => {
		expect(getDaysBetweenDates(new Date(2024, 0, 15), new Date(2024, 0, 16))).toBe(1);
	});

	it('handles month and year boundaries', () => {
		expect(getDaysBetweenDates(new Date(2024, 0, 31), new Date(2024, 1, 1))).toBe(1);
		expect(getDaysBetweenDates(new Date(2023, 11, 31), new Date(2024, 0, 1))).toBe(1);
	});
});

describe('getDaysSinceLastSeen', () => {
	it('returns Infinity when never seen', () => {
		expect(getDaysSinceLastSeen(null)).toBe(Infinity);
	});

	it('returns the day difference from today', () => {
		expect(getDaysSinceLastSeen(daysAgo(3))).toBe(3);
	});
});

describe('isCardDue / isScheduleDue', () => {
	const card = (lastSeen: Date | null, interval: number): CardSchedulingData => ({
		grade: null,
		repCount: 0,
		easiness: 2.5,
		interval,
		lastSeen,
		priority: Priority.A
	});

	it('treats a never-seen card as due', () => {
		expect(isCardDue(card(null, 5))).toBe(true);
		expect(isScheduleDue({ ...card(null, 5) })).toBe(true);
	});

	it('is due when days since last seen >= interval (boundary)', () => {
		expect(isCardDue(card(daysAgo(5), 5))).toBe(true);
	});

	it('is not due when days since last seen < interval', () => {
		expect(isCardDue(card(daysAgo(0), 1))).toBe(false);
		expect(isCardDue(card(daysAgo(4), 5))).toBe(false);
	});
});

describe('sortCardsByPriorityAndDueDate', () => {
	it('orders by priority A < B < C, then by earliest due date', () => {
		const c = (
			priority: Priority,
			lastSeen: Date | null,
			interval: number
		): CardSchedulingData => ({
			grade: null,
			repCount: 0,
			easiness: 2.5,
			interval,
			lastSeen,
			priority
		});

		const cLow = c(Priority.C, daysAgo(1), 1);
		const bMid = c(Priority.B, daysAgo(1), 1);
		const aLater = c(Priority.A, daysAgo(0), 10);
		const aSooner = c(Priority.A, daysAgo(10), 1);

		const sorted = sortCardsByPriorityAndDueDate([cLow, aLater, bMid, aSooner]);

		expect(sorted.map((card) => card.priority)).toEqual([
			Priority.A,
			Priority.A,
			Priority.B,
			Priority.C
		]);
		// Within priority A, the one due sooner comes first.
		expect(sorted[0]).toBe(aSooner);
		expect(sorted[1]).toBe(aLater);
	});
});

describe('countDueCardsByPriority', () => {
	it('buckets due cards by priority and totals them', () => {
		const card = (priority: string, lastSeen: Date | null, interval: number) => ({
			lastSeen,
			interval,
			grade: null,
			priority,
			repCount: 0,
			easiness: 2.5
		});

		const counts = countDueCardsByPriority([
			card('A', null, 1), // due
			card('A', daysAgo(0), 5), // not due
			card('B', daysAgo(10), 1), // due
			card('C', daysAgo(5), 5), // due
			card('C', daysAgo(1), 30) // not due
		]);

		expect(counts).toEqual({ total: 3, priorityA: 1, priorityB: 1, priorityC: 1 });
	});
});
