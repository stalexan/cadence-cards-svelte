import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { signIn } from '../../auth';
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
		// Clone the request so we can read the form data for validation
		// while still allowing signIn to read the original request
		const clonedRequest = event.request.clone();
		const formData = await clonedRequest.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		console.log('🔑 Login attempt for:', email);

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password are required',
				email
			});
		}

		// Pre-validate credentials to provide better error messages
		// (signIn would just redirect to login with a generic error)
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

		console.log('✅ Credentials valid! Delegating to signIn...');

		// Call signIn as an action - it will read the form data from event.request
		// The form includes providerId="credentials" and redirectTo="/dashboard"
		return signIn(event);
	}
};
