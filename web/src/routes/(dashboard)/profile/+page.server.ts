import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';
import { hash, compare } from 'bcryptjs';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/login');
	}

	const userId = parseInt(session.user.id, 10);

	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				createdAt: true
			}
		});

		return { user };
	} catch (error) {
		console.error('Error fetching user profile:', error);
		throw redirect(303, '/dashboard');
	}
};

export const actions: Actions = {
	updateProfile: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const userId = parseInt(session.user.id, 10);
		const formData = await event.request.formData();

		const name = formData.get('name') as string;
		const email = formData.get('email') as string;

		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		if (!email?.trim()) {
			return fail(400, { error: 'Email is required' });
		}

		try {
			await prisma.user.update({
				where: { id: userId },
				data: {
					name: name.trim(),
					email: email.trim()
				}
			});

			return { success: true, message: 'Profile updated successfully' };
		} catch (error) {
			console.error('Error updating profile:', error);
			return fail(500, { error: 'Failed to update profile' });
		}
	},

	changePassword: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) {
			return fail(401, { error: 'Unauthorized' });
		}

		const userId = parseInt(session.user.id, 10);
		const formData = await event.request.formData();

		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { passwordError: 'All password fields are required' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { passwordError: 'New passwords do not match' });
		}

		if (newPassword.length < 8) {
			return fail(400, { passwordError: 'Password must be at least 8 characters' });
		}

		try {
			const user = await prisma.user.findUnique({
				where: { id: userId }
			});

			if (!user) {
				return fail(404, { passwordError: 'User not found' });
			}

			const isValidPassword = await compare(currentPassword, user.password || '');
			if (!isValidPassword) {
				return fail(400, { passwordError: 'Current password is incorrect' });
			}

			const hashedPassword = await hash(newPassword, 12);
			await prisma.user.update({
				where: { id: userId },
				data: { password: hashedPassword }
			});

			return { passwordSuccess: true, passwordMessage: 'Password changed successfully' };
		} catch (error) {
			console.error('Error changing password:', error);
			return fail(500, { passwordError: 'Failed to change password' });
		}
	}
};
