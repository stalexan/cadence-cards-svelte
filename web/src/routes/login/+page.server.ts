import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';
import { compare } from 'bcryptjs';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (session?.user) {
		throw redirect(303, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		console.log('🔑 Login attempt for:', email);

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password are required',
				email
			});
		}

		// Manual authentication check
		const user = await prisma.user.findUnique({
			where: { email }
		});

		console.log('🔑 User lookup:', { found: !!user, hasPassword: !!user?.password });

		if (!user || !user.password) {
			return fail(401, {
				error: 'Invalid email or password',
				email
			});
		}

		const isPasswordValid = await compare(password, user.password);
		console.log('🔑 Password valid:', isPasswordValid);

		if (!isPasswordValid) {
			return fail(401, {
				error: 'Invalid email or password',
				email
			});
		}

		// Authentication successful
		console.log('✅ Credentials valid! User authenticated');

		// Make a server-side request to Auth.js signin endpoint
		try {
			// Auth.js uses different cookie names depending on secure mode:
			// - Production (HTTPS): __Host-authjs.csrf-token
			// - Development (HTTP): authjs.csrf-token
			const csrfCookie =
				event.cookies.get('__Host-authjs.csrf-token') ||
				event.cookies.get('authjs.csrf-token') ||
				'';
			const csrfToken = csrfCookie.split('|')[0];
			console.log('CSRF token:', csrfToken ? 'present' : 'missing');

			// Send as URL-encoded form data (what browsers send)
			const body = new URLSearchParams({
				email,
				password,
				callbackUrl: '/dashboard',
				csrfToken
			});

			const authResponse = await fetch(new URL('/auth/callback/credentials', event.url.origin), {
				method: 'POST',
				body: body.toString(),
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					cookie: event.request.headers.get('cookie') || ''
				},
				redirect: 'manual'
			});

			console.log('Auth response:', authResponse.status, authResponse.headers.get('location'));

			// Get the set-cookie headers from auth response
			const setCookieHeaders = authResponse.headers.getSetCookie();
			console.log('Set-Cookie headers:', setCookieHeaders);

			if (authResponse.status >= 300 && authResponse.status < 400) {
				const location = authResponse.headers.get('location');
				if (location && !location.includes('/auth/signin') && !location.includes('error')) {
					// Success! Set the cookies from auth response
					for (const cookieHeader of setCookieHeaders) {
						// Parse the cookie and set it using SvelteKit's cookies API
						const cookieParts = cookieHeader.split(';');
						const [nameValue, ...options] = cookieParts;
						// Use indexOf to split on first '=' only (JWT tokens contain '=' chars)
						const eqIndex = nameValue.indexOf('=');
						const name = nameValue.substring(0, eqIndex);
						// Decode the value - Auth.js URL-encodes cookie values in Set-Cookie headers
						// but we need to decode them before setting via SvelteKit's cookies API
						const rawValue = nameValue.substring(eqIndex + 1);
						// Handle both secure-prefixed (production) and non-prefixed (dev) cookie names
						const isCallbackUrl =
							name === 'authjs.callback-url' || name === '__Host-authjs.callback-url';
						const value = isCallbackUrl ? decodeURIComponent(rawValue) : rawValue;

						const cookieOptions: Parameters<typeof event.cookies.set>[2] = {
							path: '/'
						};

						for (const option of options) {
							const optionTrimmed = option.trim();
							const optEqIndex = optionTrimmed.indexOf('=');
							const key =
								optEqIndex === -1 ? optionTrimmed : optionTrimmed.substring(0, optEqIndex);
							const val = optEqIndex === -1 ? '' : optionTrimmed.substring(optEqIndex + 1);
							const keyLower = key.toLowerCase();
							if (keyLower === 'path') cookieOptions.path = val;
							if (keyLower === 'httponly') cookieOptions.httpOnly = true;
							if (keyLower === 'secure') cookieOptions.secure = true;
							if (keyLower === 'samesite')
								cookieOptions.sameSite = val.toLowerCase() as 'lax' | 'strict' | 'none';
							if (keyLower === 'expires') cookieOptions.expires = new Date(val);
							if (keyLower === 'max-age') cookieOptions.maxAge = parseInt(val);
						}

						console.log('Setting cookie:', name, 'with options:', cookieOptions);
						event.cookies.set(name, value, cookieOptions);
					}

					// Redirect to dashboard
					throw redirect(303, '/dashboard');
				}
			}
		} catch (error) {
			if (error instanceof Response) {
				throw error;
			}
			console.error('Auth request error:', error);
		}

		// Fallback - shouldn't reach here if auth succeeded
		console.log('Fallback: Manually redirecting to dashboard');
		throw redirect(303, '/dashboard');
	}
};
