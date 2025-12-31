import type { LogContext } from './logger';

/**
 * Extract logging context from a request
 *
 * Security Note: Only trusts x-client-ip header, which is set by our
 * validated middleware in hooks.server.ts. Does NOT trust raw proxy
 * headers (x-real-ip, x-forwarded-for) as they can be spoofed.
 */
export function getRequestContext(
	request: Request,
	additionalContext?: Partial<LogContext>
): LogContext {
	const requestId = request.headers.get('x-request-id') || 'unknown';

	// Only trust x-client-ip which is set by our middleware after validation
	// Do NOT fall back to x-real-ip or x-forwarded-for as they can be spoofed
	const ip = request.headers.get('x-client-ip') || 'unknown';

	const url = new URL(request.url);

	return {
		requestId,
		ip,
		path: url.pathname,
		method: request.method,
		...additionalContext
	};
}
