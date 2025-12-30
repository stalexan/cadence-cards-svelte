import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { prisma } from '$lib/server/db';
import { hash, compare } from 'bcryptjs';

/**
 * GET /api/user/profile - Get user profile
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				createdAt: true
			}
		});

		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}

		return json(user);
	} catch (err) {
		return handleApiError(err, { operation: 'get_profile' });
	}
};

// Validation schema for updating profile
const updateProfileSchema = z.object({
	name: z.string().min(1, 'Name is required').optional(),
	email: z.string().email('Invalid email address').optional(),
	currentPassword: z.string().optional(),
	newPassword: z.string().min(8, 'Password must be at least 8 characters').optional()
});

/**
 * PUT /api/user/profile - Update user profile
 */
export const PUT: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const body = await event.request.json();
		const validatedData = updateProfileSchema.parse(body);

		const user = await prisma.user.findUnique({
			where: { id: userId }
		});

		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}

		// If changing password, verify current password
		if (validatedData.newPassword) {
			if (!validatedData.currentPassword) {
				return json({ message: 'Current password is required' }, { status: 400 });
			}

			const isValidPassword = await compare(validatedData.currentPassword, user.password || '');
			if (!isValidPassword) {
				return json({ message: 'Current password is incorrect' }, { status: 400 });
			}
		}

		// Build update data
		const updateData: { name?: string; email?: string; password?: string } = {};
		if (validatedData.name) updateData.name = validatedData.name;
		if (validatedData.email) updateData.email = validatedData.email;
		if (validatedData.newPassword) {
			updateData.password = await hash(validatedData.newPassword, 12);
		}

		const updatedUser = await prisma.user.update({
			where: { id: userId },
			data: updateData,
			select: {
				id: true,
				name: true,
				email: true,
				createdAt: true
			}
		});

		return json(updatedUser);
	} catch (err) {
		return handleApiError(err, { operation: 'update_profile' });
	}
};
