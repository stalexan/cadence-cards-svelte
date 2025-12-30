#!/usr/bin/env tsx
/**
 * Script to delete a user account
 *
 * NOTE: If you see errors like "Cannot find name 'process'" or missing types for Node.js,
 * run: npm install --save-dev @types/node
 *
 * Usage:
 *   npx tsx scripts/delete-user.ts --email <email> [--yes]
 *   npx tsx scripts/delete-user.ts --id <userId> [--yes]
 *
 * Example:
 *   npx tsx scripts/delete-user.ts --email user@example.com
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

// Initialize Prisma client
const prisma = new PrismaClient();

function printUsageAndExit(): never {
	console.error(
		`\nUsage:\n  npx tsx scripts/delete-user.ts --email <email> [--yes]\n  npx tsx scripts/delete-user.ts --id <userId> [--yes]\n`
	);
	process.exit(1);
	return undefined as never; // Fix linter: function returning never must not have reachable end
}

function parseArgs() {
	const args = process.argv.slice(2);
	let email: string | undefined;
	let userId: number | undefined;
	let yes = false;

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
		} else if (args[i] === '--yes' || args[i] === '-y') {
			yes = true;
		}
	}

	if (!email && !userId) {
		printUsageAndExit();
	}

	return { email, userId, yes };
}

function confirm(prompt: string): Promise<boolean> {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		rl.question(`${prompt} [y/N]: `, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
		});
	});
}

async function main() {
	try {
		const { email, userId, yes } = parseArgs();

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

		// Get user's data counts for confirmation
		const topicsCount = await prisma.topic.count({
			where: { userId: user.id }
		});
		const decksCount = await prisma.deck.count({
			where: { topic: { userId: user.id } }
		});
		const cardsCount = await prisma.card.count({
			where: { deck: { topic: { userId: user.id } } }
		});

		console.log(`\nUser to delete:`);
		console.log(`  ID: ${user.id}`);
		console.log(`  Name: ${user.name || 'N/A'}`);
		console.log(`  Email: ${user.email || 'N/A'}`);
		console.log(`\nThis will also delete:`);
		console.log(`  ${topicsCount} topic(s)`);
		console.log(`  ${decksCount} deck(s)`);
		console.log(`  ${cardsCount} card(s)`);

		// Confirm deletion
		if (!yes) {
			const confirmed = await confirm(
				`\nAre you sure you want to delete this user and all associated data?`
			);
			if (!confirmed) {
				console.log('Aborted.');
				return;
			}
		}

		// Delete user and all associated data atomically using a transaction
		// This ensures all-or-nothing deletion: if any operation fails, all changes are rolled back
		await prisma.$transaction([
			prisma.card.deleteMany({
				where: { deck: { topic: { userId: user.id } } }
			}),
			prisma.deck.deleteMany({
				where: { topic: { userId: user.id } }
			}),
			prisma.topic.deleteMany({ where: { userId: user.id } }),
			prisma.user.delete({ where: { id: user.id } })
		]);

		console.log(`\nUser ${user.id} (${user.email || 'no email'}) deleted successfully.`);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
