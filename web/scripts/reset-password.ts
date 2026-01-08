#!/usr/bin/env tsx
/**
 * Script to reset a user's password by email or user ID
 *
 * NOTE: If you see errors like "Cannot find name 'process'" or missing types for Node.js,
 * run: npm install --save-dev @types/node
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts --email <email>
 *   npx tsx scripts/reset-password.ts --id <userId>
 *
 * Example:
 *   npx tsx scripts/reset-password.ts --email user@example.com
 *   npx tsx scripts/reset-password.ts --id 1
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/server/password';
import * as readline from 'readline';
import { Writable } from 'stream';

// Initialize Prisma client
const prisma = new PrismaClient();

// MuteStream: suppresses all output except the prompt
class MuteStream extends Writable {
	_write(_chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
		// Do nothing (suppress output)
		callback();
	}
}

function printUsageAndExit(): never {
	console.error(
		`\nUsage:\n  npx tsx scripts/reset-password.ts --email <email>\n  npx tsx scripts/reset-password.ts --id <userId>\n`
	);
	process.exit(1);
	return undefined as never; // Fix linter: function returning never must not have reachable end
}

function parseArgs() {
	const args = process.argv.slice(2);
	let email: string | undefined;
	let userId: number | undefined;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--email' && args[i + 1]) {
			email = args[i + 1];
			i++;
		} else if (args[i] === '--id' && args[i + 1]) {
			userId = parseInt(args[i + 1], 10);
			if (isNaN(userId)) {
				console.error('Error: userId must be a number');
				printUsageAndExit();
			}
			i++;
		}
	}

	if (!email && !userId) {
		printUsageAndExit();
	}

	return { email, userId };
}

function promptForPassword(promptText = 'Enter new password: '): Promise<string> {
	return new Promise((resolve) => {
		const mutableStdout = new MuteStream();
		const rl = readline.createInterface({
			input: process.stdin,
			output: mutableStdout,
			terminal: true
		});
		process.stdout.write(promptText);
		rl.question('', (password) => {
			process.stdout.write('\n');
			rl.close();
			resolve(password.trim());
		});
	});
}

async function promptForPasswordWithConfirmation(): Promise<string> {
	while (true) {
		const password = await promptForPassword('Enter new password: ');
		if (!password) {
			console.error('Password cannot be empty. Please try again.');
			continue;
		}
		const confirm = await promptForPassword('Confirm new password: ');
		if (password !== confirm) {
			console.error('Passwords do not match. Please try again.');
			continue;
		}
		return password;
	}
}

async function main() {
	try {
		const { email, userId } = parseArgs();

		// Find user
		let user;
		if (email) {
			user = await prisma.user.findUnique({ where: { email } });
		} else if (userId) {
			user = await prisma.user.findUnique({ where: { id: userId } });
		}

		if (!user) {
			console.error('Error: User not found');
			process.exit(1);
		}

		// Prompt for new password
		const password = await promptForPasswordWithConfirmation();

		// Hash new password
		const hashedPassword = await hashPassword(password);

		// Update password
		await prisma.user.update({
			where: { id: user.id },
			data: { password: hashedPassword }
		});

		console.log(`Password reset successful for user ID ${user.id} (${user.email || 'no email'})`);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
