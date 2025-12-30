/**
 * Configuration utilities for application settings
 */

import { env } from '$env/dynamic/private';

/**
 * Check if public registration is enabled
 * @returns true if ENABLE_PUBLIC_REGISTRATION is set to "true", false otherwise
 */
export function isPublicRegistrationEnabled(): boolean {
	return env.ENABLE_PUBLIC_REGISTRATION === 'true';
}
