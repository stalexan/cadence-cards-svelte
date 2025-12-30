import { env } from '$env/dynamic/private';

// Rate Limiting Configuration Constants
const RATE_LIMIT_SETTINGS = {
	// General IP rate limiting
	DEFAULT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
	DEFAULT_MAX_REQUESTS: 100,

	// Authentication attempt rate limiting
	AUTH_ATTEMPT_WINDOW_MS: 30 * 60 * 1000, // 30 minutes
	AUTH_ATTEMPT_MAX_TRIES: 3,

	// IP lockout settings
	IP_COOLDOWN_THRESHOLD: 3, // Failed attempts before 5-minute cooldown
	IP_LOCKOUT_THRESHOLD: 5, // Failed attempts before 15-minute lockout
	IP_COOLDOWN_DURATION_MS: 5 * 60 * 1000, // 5 minutes
	IP_LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes

	// Account lockout settings
	ACCOUNT_FAILURE_WINDOW_MS: 30 * 60 * 1000, // 30 minutes
	ACCOUNT_LOCKOUT_THRESHOLD: 3, // Failed attempts before account lockout
	ACCOUNT_LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes

	// Cleanup settings
	CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
	CLEANUP_ENTRY_EXPIRY_MS: 60 * 60 * 1000 // 1 hour
} as const;

interface RateLimitCount {
	count: number;
	resetTime: number;
	lastAttempt: number;
}

interface FailedAuthCount {
	count: number;
	lockoutUntil?: number;
	attempts: number[];
}

class RateLimiter {
	private ipRateLimits = new Map<string, RateLimitCount>(); // Map of IP addresses to rate limit entries
	private ipAuthFailures = new Map<string, FailedAuthCount>(); // Map of IP addresses to failed authentication attempts
	private emailAuthFailures = new Map<string, FailedAuthCount>(); // Map of email addresses to failed authentication attempts
	private cleanupInterval: ReturnType<typeof setInterval> | null = null; // Interval for cleanup process

	public constructor() {
		// Start cleanup process - runs every hour
		this.startCleanup();
	}

	/**
	 * Check if IP is rate limited for general requests.
	 * Default is 100 requests per 15 minutes.
	 */
	public checkIPRateLimit(
		ip: string,
		windowMs: number = RATE_LIMIT_SETTINGS.DEFAULT_WINDOW_MS,
		maxRequests: number = RATE_LIMIT_SETTINGS.DEFAULT_MAX_REQUESTS
	): boolean {
		const now: number = Date.now();
		const entry: RateLimitCount | undefined = this.ipRateLimits.get(ip);

		// If no entry or reset time has passed, create a new entry
		if (!entry || now > entry.resetTime) {
			this.ipRateLimits.set(ip, {
				count: 1,
				resetTime: now + windowMs,
				lastAttempt: now
			});
			return false; // Not limited
		}

		// Increment count and update last attempt time
		entry.count++;
		entry.lastAttempt = now;

		// If count exceeds maxRequests, log violation and return true (rate limited)
		if (entry.count > maxRequests) {
			this.logViolation('IP_RATE_LIMIT', ip, entry.count, maxRequests);
			return true; // Rate limited
		}

		return false;
	}

	/**
	 * Check if IP is rate limited specifically for authentication attempts.
	 * This uses a separate counter from general rate limits and is meant for brute force protection.
	 * Only failed authentication attempts should increment this counter.
	 */
	public checkAuthAttemptRateLimit(ip: string): boolean {
		const now: number = Date.now();
		const windowMs: number = RATE_LIMIT_SETTINGS.AUTH_ATTEMPT_WINDOW_MS;
		const maxAttempts: number = RATE_LIMIT_SETTINGS.AUTH_ATTEMPT_MAX_TRIES;

		// Get or create the failed auth entry
		const entry: FailedAuthCount | undefined = this.ipAuthFailures.get(ip);
		if (!entry) {
			return false; // No failed attempts recorded, so not rate limited
		}

		// Clean old attempts (only count failures in last 15 minutes)
		entry.attempts = entry.attempts.filter((attempt) => now - attempt < windowMs);
		entry.count = entry.attempts.length;

		// Check if we're within the rate limit
		if (entry.count >= maxAttempts) {
			this.logViolation('AUTH_ATTEMPT_RATE_LIMIT', ip, entry.count, maxAttempts);
			return true; // Rate limited
		}

		return false;
	}

	/**
	 * Record failed authentication attempt and check if account should be locked
	 */
	public recordFailedAuth(
		ip: string,
		email?: string
	): {
		ipBlocked: boolean;
		accountLocked: boolean;
		lockoutUntil?: number;
	} {
		const now: number = Date.now();

		// Find or create FailedAuthCount for this IP address
		let ipEntry: FailedAuthCount | undefined = this.ipAuthFailures.get(ip);
		if (!ipEntry) {
			ipEntry = { count: 0, attempts: [] };
			this.ipAuthFailures.set(ip, ipEntry);
		}

		// Clean old attempts (only count failures in last 15 minutes)
		const windowMs: number = RATE_LIMIT_SETTINGS.AUTH_ATTEMPT_WINDOW_MS;
		ipEntry.attempts = ipEntry.attempts.filter((attempt) => now - attempt < windowMs);

		// Add current attempt to list of attempts
		ipEntry.attempts.push(now);
		ipEntry.count = ipEntry.attempts.length;

		// Is IP locked out? 3 failures = 5 min lockout, 5+ failures = 15 min lockout
		let ipBlocked: boolean = false;
		if (ipEntry.count >= RATE_LIMIT_SETTINGS.IP_LOCKOUT_THRESHOLD) {
			ipEntry.lockoutUntil = now + RATE_LIMIT_SETTINGS.IP_LOCKOUT_DURATION_MS;
			ipBlocked = true;
			this.logViolation(
				'AUTH_IP_LOCKOUT',
				ip,
				ipEntry.count,
				RATE_LIMIT_SETTINGS.IP_LOCKOUT_THRESHOLD
			);
		} else if (ipEntry.count >= RATE_LIMIT_SETTINGS.IP_COOLDOWN_THRESHOLD) {
			ipEntry.lockoutUntil = now + RATE_LIMIT_SETTINGS.IP_COOLDOWN_DURATION_MS;
			ipBlocked = true;
			this.logViolation(
				'AUTH_IP_COOLDOWN',
				ip,
				ipEntry.count,
				RATE_LIMIT_SETTINGS.IP_COOLDOWN_THRESHOLD
			);
		}

		// Track email-based failures if email provided
		let accountLocked: boolean = false;
		let lockoutUntil: number | undefined;
		if (email) {
			// Find or create FailedAuthCount for this email address
			let emailEntry: FailedAuthCount | undefined = this.emailAuthFailures.get(email);
			if (!emailEntry) {
				emailEntry = { count: 0, attempts: [] };
				this.emailAuthFailures.set(email, emailEntry);
			}

			// Clean old attempts (count failures in last 30 minutes for account lockout)
			const emailWindowMs: number = RATE_LIMIT_SETTINGS.ACCOUNT_FAILURE_WINDOW_MS;
			emailEntry.attempts = emailEntry.attempts.filter((attempt) => now - attempt < emailWindowMs);

			// Add current attempt to list of attempts
			emailEntry.attempts.push(now);
			emailEntry.count = emailEntry.attempts.length;

			// Is account locked out? 5 failures = 15 minutes lockout
			if (emailEntry.count >= RATE_LIMIT_SETTINGS.ACCOUNT_LOCKOUT_THRESHOLD) {
				emailEntry.lockoutUntil = now + RATE_LIMIT_SETTINGS.ACCOUNT_LOCKOUT_DURATION_MS;
				lockoutUntil = emailEntry.lockoutUntil;
				accountLocked = true;
				this.logViolation(
					'ACCOUNT_LOCKOUT',
					email,
					emailEntry.count,
					RATE_LIMIT_SETTINGS.ACCOUNT_LOCKOUT_THRESHOLD
				);
			}
		}

		return {
			ipBlocked: ipBlocked && (ipEntry.lockoutUntil ? now < ipEntry.lockoutUntil : false),
			accountLocked: accountLocked && (lockoutUntil ? now < lockoutUntil : false),
			lockoutUntil
		};
	}

	/**
	 * Check if IP is currently locked out from auth attempts
	 */
	public isIPLockedOut(ip: string): boolean {
		// Is there a FailedAuthCount for this IP address?
		const entry: FailedAuthCount | undefined = this.ipAuthFailures.get(ip);

		// If there is no FailedAuthCount or the lockoutUntil is not set, return false
		if (!entry || !entry.lockoutUntil) return false;

		// If the lockoutUntil has passed, clean it up and return false
		const now: number = Date.now();
		if (now > entry.lockoutUntil) {
			// Lockout expired, clean it up
			delete entry.lockoutUntil;
			return false;
		}

		return true;
	}

	/**
	 * Check if account (email) is currently locked out
	 */
	public isAccountLockedOut(email: string): {
		locked: boolean;
		until?: number;
	} {
		// Is there a FailedAuthCount for this email address?
		const entry: FailedAuthCount | undefined = this.emailAuthFailures.get(email);

		// If there is no FailedAuthCount or the lockoutUntil is not set, return false
		if (!entry || !entry.lockoutUntil) return { locked: false };

		// If the lockoutUntil has passed, clean it up and return false
		const now: number = Date.now();
		if (now > entry.lockoutUntil) {
			// Lockout expired, clean it up
			delete entry.lockoutUntil;
			return { locked: false };
		}

		return { locked: true, until: entry.lockoutUntil };
	}

	/**
	 * Clear failed attempts for successful authentication
	 */
	public clearFailedAttempts(ip: string, email?: string): void {
		// Clear IP-based auth failures and lockouts
		if (ip) {
			this.ipAuthFailures.delete(ip);
		}

		// Clear email-based auth failures and lockouts
		if (email) {
			this.emailAuthFailures.delete(email);
		}
	}

	/**
	 * Clear IP-based rate limits (useful for successful authentication)
	 */
	public clearIPRateLimit(ip: string): void {
		this.ipRateLimits.delete(ip);
	}

	/**
	 * Log rate limit violations
	 */
	private logViolation(type: string, identifier: string, current: number, limit: number): void {
		const timestamp: string = new Date().toISOString();
		console.log(`🚨 [RATE_LIMIT_VIOLATION] ${timestamp}`);
		console.log(`   Type: ${type}`);
		console.log(`   Identifier: ${identifier}`);
		console.log(`   Current: ${current} attempts`);
		console.log(`   Limit: ${limit}`);
		console.log(`   Action: Request blocked`);
	}

	/**
	 * Start automatic cleanup process
	 */
	private startCleanup(): void {
		// Run cleanup every hour
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, RATE_LIMIT_SETTINGS.CLEANUP_INTERVAL_MS);
	}

	/**
	 * Clean up expired entries to prevent memory leaks
	 */
	private cleanup(): void {
		const now: number = Date.now();
		let cleaned: number = 0;

		// Clean IP limits
		for (const [ip, entry] of this.ipRateLimits.entries()) {
			if (now > entry.resetTime) {
				this.ipRateLimits.delete(ip);
				cleaned++;
			}
		}

		// Clean IP auth failures (remove entries older than 1 hour)
		const authWindowMs: number = RATE_LIMIT_SETTINGS.CLEANUP_ENTRY_EXPIRY_MS;
		for (const [ip, entry] of this.ipAuthFailures.entries()) {
			if (entry.attempts.length === 0 || now - Math.max(...entry.attempts) > authWindowMs) {
				this.ipAuthFailures.delete(ip);
				cleaned++;
			}
		}

		// Clean email failures (remove entries older than 1 hour)
		for (const [email, entry] of this.emailAuthFailures.entries()) {
			if (entry.attempts.length === 0 || now - Math.max(...entry.attempts) > authWindowMs) {
				this.emailAuthFailures.delete(email);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			console.log(
				`🧹 [RATE_LIMITER] Cleaned up ${cleaned} expired entries at ${new Date().toISOString()}`
			);
		}
	}

	/**
	 * Get current stats for monitoring
	 */
	public getStats(): {
		activeIPLimits: number;
		activeAuthFailures: number;
		activeEmailFailures: number;
	} {
		return {
			activeIPLimits: this.ipRateLimits.size,
			activeAuthFailures: this.ipAuthFailures.size,
			activeEmailFailures: this.emailAuthFailures.size
		};
	}

	/**
	 * Stop cleanup process (for testing or shutdown)
	 */
	public destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}
}

// Singleton instance
export const rateLimiter: RateLimiter = new RateLimiter();

// Development bypass flag
export const DISABLE_RATE_LIMITING =
	env.NODE_ENV === 'development' && env.DISABLE_RATE_LIMITING === 'true';
