import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();

	if (!session?.user) {
		throw redirect(303, '/login');
	}

	return {
		session,
		user: session.user,
		appVersion: env.APP_VERSION || 'unknown'
	};
};
