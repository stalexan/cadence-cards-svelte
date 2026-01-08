import { sequence } from '@sveltejs/kit/hooks';
import { authHandle } from './auth';
import { rateLimiter, DISABLE_RATE_LIMITING } from '$lib/server/rate-limiter';
import type { Handle, RequestEvent } from '@sveltejs/kit';

/**
 * Extract client IP from request headers (for proxy setups)
 *
 * Security note: We only trust x-real-ip which nginx sets from $remote_addr.
 * Nginx clears potentially spoofed headers (cf-connecting-ip, x-client-ip, etc.)
 * in each server block before setting X-Real-IP to the trusted $remote_addr value.
 *
 * If Cloudflare support is needed in the future, configure nginx's real_ip_module
 * to validate cf-connecting-ip only from Cloudflare IP ranges, rather than
 * trusting the header blindly in application code.
 */
function getClientIP(event: RequestEvent): string {
	// Trust nginx-set header (nginx clears spoofed values in each server block)
	const realIP: string | null = event.request.headers.get('x-real-ip');
	if (realIP) return realIP;

	// Fallback for direct access (development without nginx)
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}

/**
 * Rate limiting middleware
 * Adds IP to request headers for auth to use and checks general rate limits
 */
const rateLimitHandle: Handle = async ({ event, resolve }) => {
	const ip = getClientIP(event);

	// Set IP header for auth to use
	event.request.headers.set('x-client-ip', ip);

	// Skip rate limiting if disabled in development
	if (DISABLE_RATE_LIMITING) {
		return resolve(event);
	}

	// Check rate limits for general requests
	if (rateLimiter.checkIPRateLimit(ip)) {
		return new Response(JSON.stringify({ error: 'Too many requests' }), {
			status: 429,
			headers: { 'content-type': 'application/json' }
		});
	}

	return resolve(event);
};

/**
 * Security headers middleware
 * Adds standard security headers to all responses
 */
const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	return response;
};

// Combine all hooks in order: rate limiting → auth → security headers
export const handle = sequence(rateLimitHandle, authHandle, securityHeadersHandle);
