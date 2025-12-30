/**
 * General utility functions for the Cadence Cards application
 */

// Date formatting utilities
/**
 * Formats a date as "DD MMM YYYY" (e.g., "15 Jan 2024").
 * Returns "Never" if the date is null or undefined.
 * @param date - Date object, date string, or null/undefined
 * @returns Formatted date string or "Never"
 */
export function formatDate(date: Date | string | null): string {
	if (!date) return 'Never';
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
}

/**
 * Formats a date and time, using "DD MMM YYYY" for the date portion.
 * @param date - Date object or date string
 * @returns Formatted date and time string (e.g., "15 Jan 2024 14:30")
 */
export function formatDateTime(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	const dateStr = d.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
	const timeStr = d.toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit'
	});
	return `${dateStr} ${timeStr}`;
}

export function getDaysFromNow(date: Date | string): number {
	const now = new Date();
	const targetDate = typeof date === 'string' ? new Date(date) : date;
	const diffTime = now.getTime() - targetDate.getTime();
	return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Text formatting utilities
export function truncateText(text: string, maxLength: number = 50): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + '...';
}

export function stripHtml(html: string): string {
	return html.replace(/<[^>]*>?/gm, '');
}

// Array utilities
export function uniqueArray<T>(array: T[]): T[] {
	return [...new Set(array)];
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
	return array.reduce(
		(result, item) => {
			const groupKey = String(item[key]);
			if (!result[groupKey]) {
				result[groupKey] = [];
			}
			result[groupKey].push(item);
			return result;
		},
		{} as Record<string, T[]>
	);
}

// Debounce function for search inputs
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null;

	return function (...args: Parameters<T>): void {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

// Pagination helpers
export interface PaginationInfo {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
	startItem: number;
	endItem: number;
}

export function getPaginationInfo(
	currentPage: number,
	totalItems: number,
	itemsPerPage: number
): PaginationInfo {
	const totalPages = Math.ceil(totalItems / itemsPerPage);
	const safePage = Math.max(1, Math.min(currentPage, totalPages || 1));
	const startItem = (safePage - 1) * itemsPerPage + 1;
	const endItem = Math.min(startItem + itemsPerPage - 1, totalItems);

	return {
		currentPage: safePage,
		totalPages,
		totalItems,
		itemsPerPage,
		startItem: totalItems === 0 ? 0 : startItem,
		endItem: totalItems === 0 ? 0 : endItem
	};
}

// Error handling
export function parseErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	return 'An unknown error occurred';
}

// Object utilities
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
	const result = { ...obj };
	keys.forEach((key) => {
		delete result[key];
	});
	return result;
}

// Type checking
export function isNullOrUndefined(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

// Generate a random string (useful for temporary IDs, etc.)
export function generateRandomString(length: number = 8): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

// URL query string helpers
export function objectToQueryString(obj: Record<string, unknown>): string {
	return Object.entries(obj)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				return value
					.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
					.join('&');
			}
			return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
		})
		.join('&');
}

export function queryStringToObject(query: string): Record<string, string> {
	if (!query || query === '') return {};

	const params = new URLSearchParams(query.startsWith('?') ? query.substring(1) : query);
	const result: Record<string, string> = {};

	params.forEach((value, key) => {
		result[key] = value;
	});

	return result;
}
