import { sequence } from '@sveltejs/kit/hooks';
import { authHandle } from './auth';
import { rateLimiter, DISABLE_RATE_LIMITING } from '$lib/server/rate-limiter';
import type { Handle, RequestEvent } from '@sveltejs/kit';

/**
 * Trusted proxy IP ranges (CIDR notation)
 * These are internal networks where proxy headers can be trusted:
 * - Loopback addresses (localhost)
 * - Docker bridge networks (172.16.0.0/12)
 * - Private networks (10.0.0.0/8, 192.168.0.0/16)
 */
const TRUSTED_PROXY_CIDRS = [
	{ ip: 0x7f000000, mask: 0xff000000 }, // 127.0.0.0/8 (loopback)
	{ ip: 0x0a000000, mask: 0xff000000 }, // 10.0.0.0/8
	{ ip: 0xac100000, mask: 0xfff00000 }, // 172.16.0.0/12 (Docker networks)
	{ ip: 0xc0a80000, mask: 0xffff0000 } // 192.168.0.0/16
];

/**
 * Parse an IPv4 address string to a 32-bit integer
 * Returns null for invalid or IPv6 addresses
 */
function parseIPv4(ip: string): number | null {
	// Handle IPv4-mapped IPv6 addresses (e.g., "::ffff:172.18.0.1")
	if (ip.startsWith('::ffff:')) {
		ip = ip.slice(7);
	}

	const parts = ip.split('.');
	if (parts.length !== 4) return null;

	let result = 0;
	for (const part of parts) {
		const num = parseInt(part, 10);
		if (isNaN(num) || num < 0 || num > 255) return null;
		result = (result << 8) | num;
	}
	return result >>> 0; // Convert to unsigned 32-bit
}

/**
 * Check if an IP address is from a trusted proxy
 * Only proxy headers from trusted sources should be used to determine client IP
 */
function isTrustedProxy(ip: string): boolean {
	// Handle IPv6 loopback
	if (ip === '::1') return true;

	const ipNum = parseIPv4(ip);
	if (ipNum === null) {
		// Unknown IPv6 address - don't trust by default
		return false;
	}

	// Check against trusted CIDR ranges
	for (const cidr of TRUSTED_PROXY_CIDRS) {
		if ((ipNum & cidr.mask) === cidr.ip) {
			return true;
		}
	}

	return false;
}

/**
 * Extract client IP from request, validating proxy headers
 *
 * Security: Only trusts proxy headers (X-Forwarded-For, X-Real-IP, etc.)
 * when the request originates from a known trusted proxy IP.
 * This prevents IP spoofing attacks where attackers inject fake headers.
 */
function getClientIP(event: RequestEvent): string {
	// Get the direct connection IP first
	let connectionIP: string;
	try {
		connectionIP = event.getClientAddress();
	} catch {
		return 'unknown';
	}

	// Only trust proxy headers if the request comes from a trusted proxy
	if (!isTrustedProxy(connectionIP)) {
		// Request is not from a trusted proxy - use the connection IP
		// This prevents attackers from spoofing their IP via headers
		return connectionIP;
	}

	// Request is from a trusted proxy - check forwarded headers
	// Order of preference: CF-Connecting-IP > X-Real-IP > X-Forwarded-For

	const cfConnectingIP = event.request.headers.get('cf-connecting-ip');
	if (cfConnectingIP) return cfConnectingIP.trim();

	const realIP = event.request.headers.get('x-real-ip');
	if (realIP) return realIP.trim();

	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded) {
		// X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
		// The first one is the original client
		return forwarded.split(',')[0].trim();
	}

	// No proxy headers found, use the connection IP
	return connectionIP;
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
