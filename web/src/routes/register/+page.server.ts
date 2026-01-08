import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';
import { hashPassword } from '$lib/server/password';
import { isPublicRegistrationEnabled } from '$lib/server/config';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (session?.user) {
		throw redirect(303, '/dashboard');
	}

	// Check if registration is enabled
	if (!isPublicRegistrationEnabled()) {
		throw redirect(303, '/login');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		// Check if registration is enabled
		if (!isPublicRegistrationEnabled()) {
			return fail(403, {
				error: 'Registration is currently disabled'
			});
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		// Validation
		if (!name || !email || !password || !confirmPassword) {
			return fail(400, {
				error: 'All fields are required',
				name,
				email
			});
		}

		if (password !== confirmPassword) {
			return fail(400, {
				error: 'Passwords do not match',
				name,
				email
			});
		}

		if (password.length < 8) {
			return fail(400, {
				error: 'Password must be at least 8 characters long',
				name,
				email
			});
		}

		// Check if user already exists
		const existingUser = await prisma.user.findUnique({
			where: { email }
		});

		if (existingUser) {
			return fail(400, {
				error: 'An account with this email already exists',
				name,
				email
			});
		}

		// Create user
		try {
			const hashedPassword = await hashPassword(password);
			await prisma.user.create({
				data: {
					name,
					email,
					password: hashedPassword
				}
			});
		} catch (error) {
			console.error('Registration error:', error);
			return fail(500, {
				error: 'An error occurred during registration',
				name,
				email
			});
		}

		throw redirect(303, '/login?registered=true');
	}
};
