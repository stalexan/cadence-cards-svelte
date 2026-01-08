/**
 * Password hashing utilities
 *
 * Centralizes password hashing configuration to ensure consistent security settings.
 */

import bcrypt from 'bcryptjs';

/**
 * Number of bcrypt rounds used for password hashing.
 * 12 rounds provides a good balance between security and performance.
 * Higher values increase computation time exponentially.
 */
export const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt with the standard number of rounds.
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}
