import type { LogContext } from './logger';

/**
 * Extract logging context from a request
 */
export function getRequestContext(
	request: Request,
	additionalContext?: Partial<LogContext>
): LogContext {
	const requestId = request.headers.get('x-request-id') || 'unknown';
	const ip =
		request.headers.get('x-client-ip') ||
		request.headers.get('x-real-ip') ||
		request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
		'unknown';

	const url = new URL(request.url);

	return {
		requestId,
		ip,
		path: url.pathname,
		method: request.method,
		...additionalContext
	};
}
