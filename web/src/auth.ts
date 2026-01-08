import { SvelteKitAuth } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import { prisma } from '$lib/server/db';
import { verifyPassword } from '$lib/server/password';
import { rateLimiter } from '$lib/server/rate-limiter';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';

// Define auth-related types
export interface AuthUser {
	id: string;
	name: string | null;
	email: string | null;
}

export const {
	handle: authHandle,
	signIn,
	signOut
} = SvelteKitAuth({
	providers: [
		Credentials({
			name: 'Credentials',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' }
			},
			async authorize(credentials, request) {
				if (!credentials?.email || !credentials?.password) {
					return null;
				}

				const email = credentials.email as string;
				const password = credentials.password as string;

				// Get client IP for rate limiting from middleware-set header
				const ip: string = request.headers.get('x-client-ip') || 'unknown';

				// Check if account is locked out
				const accountLockout: { locked: boolean; until?: number } =
					rateLimiter.isAccountLockedOut(email);
				if (accountLockout.locked) {
					logger.security('Account locked out', {
						email,
						ip,
						lockedUntil: accountLockout.until
							? new Date(accountLockout.until).toISOString()
							: undefined,
						operation: 'auth_attempt_blocked'
					});
					return null;
				}

				const user = await prisma.user.findUnique({
					where: {
						email: email
					}
				});

				if (!user || !user.password) {
					// Record failed attempt (no user found)
					rateLimiter.recordFailedAuth(ip, email);
					logger.security('Failed login attempt - user not found', {
						email,
						ip,
						operation: 'auth_failed',
						reason: 'user_not_found'
					});
					return null;
				}

				const isPasswordValid = await verifyPassword(password, user.password);

				if (!isPasswordValid) {
					// Record failed attempt (wrong password)
					rateLimiter.recordFailedAuth(ip, email);
					logger.security('Failed login attempt - invalid password', {
						email,
						ip,
						operation: 'auth_failed',
						reason: 'invalid_password'
					});
					return null;
				}

				// Successful authentication - clear any failed attempts immediately
				rateLimiter.clearFailedAttempts(ip, email);
				logger.audit('Successful login', {
					email,
					ip,
					userId: user.id,
					operation: 'auth_success'
				});

				return {
					id: user.id.toString(),
					email: user.email,
					name: user.name
				};
			}
		})
	],
	session: {
		strategy: 'jwt',
		maxAge: 30 * 24 * 60 * 60 // 30 days
	},
	pages: {
		signIn: '/login',
		newUser: '/register'
	},
	callbacks: {
		async jwt({ token, user, trigger, session }) {
			// Initial sign in
			if (user) {
				token.id = user.id;
				token.name = user.name;
				token.email = user.email;
			}

			// Update token when session is updated
			if (trigger === 'update' && session) {
				if (session.user?.name) token.name = session.user.name;
				if (session.user?.email) token.email = session.user.email;
			}

			return token;
		},
		async session({ session, token }) {
			if (token && session.user) {
				session.user.id = token.id as string;
				session.user.name = (token.name as string) || '';
				session.user.email = (token.email as string) || '';
			}
			return session;
		}
	},
	secret: env.AUTH_SECRET,
	trustHost: true
});
