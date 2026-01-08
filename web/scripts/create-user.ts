#!/usr/bin/env tsx
/**
 * Script to create a new user account
 *
 * NOTE: If you see errors like "Cannot find name 'process'" or missing types for Node.js,
 * run: npm install --save-dev @types/node
 *
 * Usage:
 *   npx tsx scripts/create-user.ts --email <email> --name <name> [--password <password>]
 *
 * Example:
 *   npx tsx scripts/create-user.ts --email user@example.com --name "John Doe"
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/server/password';
import * as readline from 'readline';
import { Writable } from 'stream';

// Initialize Prisma client
const prisma = new PrismaClient();

// MuteStream: suppresses all output except the prompt
class MuteStream extends Writable {
	_write(_chunk: unknown, _encoding: string, callback: () => void) {
		// Do nothing (suppress output)
		callback();
	}
}

function printUsageAndExit(): never {
	console.error(
		`\nUsage:\n  npx tsx scripts/create-user.ts --email <email> --name <name> [--password <password>]\n`
	);
	process.exit(1);
	return undefined as never; // Fix linter: function returning never must not have reachable end
}

function parseArgs() {
	const args = process.argv.slice(2);
	let email: string | undefined;
	let name: string | undefined;
	let password: string | undefined;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--email' && args[i + 1]) {
			email = args[i + 1];
			i++;
		} else if (args[i] === '--name' && args[i + 1]) {
			name = args[i + 1];
			i++;
		} else if (args[i] === '--password' && args[i + 1]) {
			password = args[i + 1];
			i++;
		}
	}

	if (!email || !name) {
		printUsageAndExit();
	}

	return { email, name, password };
}

function promptForPassword(promptText = 'Enter password: '): Promise<string> {
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
		const password = await promptForPassword('Enter password: ');
		if (!password) {
			console.error('Password cannot be empty. Please try again.');
			continue;
		}
		if (password.length < 8) {
			console.error('Password must be at least 8 characters. Please try again.');
			continue;
		}
		const confirm = await promptForPassword('Confirm password: ');
		if (password !== confirm) {
			console.error('Passwords do not match. Please try again.');
			continue;
		}
		return password;
	}
}

async function main() {
	try {
		const { email, name, password: providedPassword } = parseArgs();

		// Check if user already exists
		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			console.error(`Error: User with email ${email} already exists`);
			process.exit(1);
		}

		// Get password
		let password: string;
		if (providedPassword) {
			if (providedPassword.length < 8) {
				console.error('Error: Password must be at least 8 characters');
				process.exit(1);
			}
			password = providedPassword;
		} else {
			password = await promptForPasswordWithConfirmation();
		}

		// Hash password
		const hashedPassword = await hashPassword(password);

		// Create user
		const user = await prisma.user.create({
			data: {
				email,
				name,
				password: hashedPassword
			}
		});

		console.log(
			`User created successfully:\n  ID: ${user.id}\n  Name: ${user.name}\n  Email: ${user.email}`
		);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
