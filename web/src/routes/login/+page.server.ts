import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { signIn } from '../../auth';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (session?.user) {
		throw redirect(303, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		// Delegate all credential validation to auth.ts, which handles:
		// - Rate limiting and account lockout checks
		// - User lookup and password validation
		// - Logging of auth attempts
		// This ensures consistent timing and proper security controls.
		return signIn(event);
	}
};
