import { describe, it, expect } from 'vitest';
import { getPaginationInfo, formatDate, formatDateTime, groupBy, truncateText } from './utils';

describe('getPaginationInfo', () => {
	it('computes start/end items for a middle page', () => {
		const info = getPaginationInfo(1, 25, 10);
		expect(info).toMatchObject({
			currentPage: 1,
			totalPages: 3,
			startItem: 1,
			endItem: 10
		});
	});

	it('clamps a too-high page down to the last page', () => {
		const info = getPaginationInfo(5, 25, 10);
		expect(info.currentPage).toBe(3);
		expect(info.startItem).toBe(21);
		expect(info.endItem).toBe(25);
	});

	it('clamps a page below 1 up to 1', () => {
		expect(getPaginationInfo(0, 25, 10).currentPage).toBe(1);
	});

	it('reports zeroed start/end when there are no items', () => {
		const info = getPaginationInfo(1, 0, 10);
		expect(info.totalPages).toBe(0);
		expect(info.startItem).toBe(0);
		expect(info.endItem).toBe(0);
	});
});

describe('formatDate', () => {
	it('returns "Never" for null', () => {
		expect(formatDate(null)).toBe('Never');
	});

	it('formats a date as "DD MMM YYYY" (en-GB)', () => {
		expect(formatDate(new Date(2024, 0, 15))).toBe('15 Jan 2024');
	});
});

describe('formatDateTime', () => {
	it('formats date and 24-hour time', () => {
		expect(formatDateTime(new Date(2024, 0, 15, 14, 30))).toBe('15 Jan 2024 14:30');
	});
});

describe('groupBy', () => {
	it('returns an empty object for an empty array', () => {
		expect(groupBy([], 'k' as never)).toEqual({});
	});

	it('groups items by the value of a key', () => {
		const items = [
			{ type: 'fruit', name: 'apple' },
			{ type: 'veg', name: 'carrot' },
			{ type: 'fruit', name: 'pear' }
		];
		const grouped = groupBy(items, 'type');
		expect(Object.keys(grouped).sort()).toEqual(['fruit', 'veg']);
		expect(grouped.fruit).toHaveLength(2);
		expect(grouped.veg).toHaveLength(1);
	});
});

describe('truncateText', () => {
	it('leaves text within the limit unchanged', () => {
		expect(truncateText('hello', 10)).toBe('hello');
	});

	it('leaves text at exactly the limit unchanged', () => {
		expect(truncateText('hello', 5)).toBe('hello');
	});

	it('appends an ellipsis when over the limit', () => {
		expect(truncateText('hello world', 5)).toBe('hello...');
	});
});
