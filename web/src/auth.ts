import { SvelteKitAuth } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import { prisma } from '$lib/server/db';
import { compare } from 'bcryptjs';
import { rateLimiter } from '$lib/server/rate-limiter';
import { logger } from '$lib/server/logger';
import { AUTH_SECRET } from '$env/static/private';

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
				console.log('🔐 AUTHORIZE called with credentials:', {
					hasEmail: !!credentials?.email,
					hasPassword: !!credentials?.password,
					email: credentials?.email
				});

				if (!credentials?.email || !credentials?.password) {
					console.log('❌ Missing credentials');
					return null;
				}

				const email = credentials.email as string;
				const password = credentials.password as string;

				// Get client IP for rate limiting from middleware-set header
				const ip: string = request.headers.get('x-client-ip') || 'unknown';
				console.log('🔐 Attempting auth for:', { email, ip });

				// Check if account is locked out
				const accountLockout: { locked: boolean; until?: number } =
					rateLimiter.isAccountLockedOut(email);
				console.log('🔐 Lockout check:', accountLockout);
				if (accountLockout.locked) {
					console.log('❌ Account is locked');
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
				console.log('🔐 User found:', {
					found: !!user,
					hasPassword: !!user?.password,
					userId: user?.id
				});

				if (!user || !user.password) {
					console.log('❌ User not found or no password');
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

				const isPasswordValid = await compare(password, user.password);
				console.log('🔐 Password check:', { isValid: isPasswordValid });

				if (!isPasswordValid) {
					console.log('❌ Invalid password');
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

				const authUser = {
					id: user.id.toString(),
					email: user.email,
					name: user.name
				};
				console.log('✅ Authentication successful, returning user:', authUser);
				return authUser;
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
	secret: AUTH_SECRET,
	trustHost: true
});
