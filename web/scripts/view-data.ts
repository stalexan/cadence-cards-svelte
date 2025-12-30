/**
 * CLI script to view and query flashcard data
 *
 * Usage:
 *   npx tsx scripts/view-data.ts [command] [options]
 *
 * Commands:
 *   summary            - Show summary statistics
 *   users              - List all users
 *   topics [userId]    - List all topics, optionally filtered by user ID
 *   decks [topicId]    - List all decks, optionally filtered by topic ID
 *   cards [deckId]     - List all cards, optionally filtered by deck ID
 *   card [cardId]      - Show details for a specific card
 *   search [text]      - Search card fronts and backs for text
 *   all                - Display all data in hierarchical structure
 *
 * Options:
 *   --limit=N           - Limit results to N items (default: all)
 *   --due               - Filter cards to show only those due today
 */

import { PrismaClient, User, Topic, Deck, Card, Prisma } from '@prisma/client';
import { stringify } from 'yaml';
import { isCardDue, CardSchedulingData } from '../src/lib/sm2.js';

// Define command types
type Command = 'summary' | 'users' | 'topics' | 'decks' | 'cards' | 'card' | 'search' | 'all';

// Initialize Prisma client
const prisma = new PrismaClient();

interface CommandOptions {
	limit: number | null;
	due: boolean; // New option to filter by due status
}

interface SummaryResult {
	users: number;
	topics: number;
	decks: number;
	cards: number;
	timestamp: string;
}

// Parse command line arguments
const args: string[] = process.argv.slice(2);
const command: Command = (args[0] || 'summary') as Command;
const param: string | undefined = args[1]?.startsWith('--') ? undefined : args[1];

// Parse options
const options: CommandOptions = {
	limit: null, // Default is all (no limit)
	due: false // Default is all cards (not just due ones)
};

args.forEach((arg: string) => {
	if (arg.startsWith('--limit=')) {
		options.limit = parseInt(arg.split('=')[1], 10);
	}
	if (arg === '--due') {
		options.due = true;
	}
});

/**
 * Output data in YAML format
 */
function output(data: unknown): void {
	// Custom stringify function that applies literal style (|-) only to multi-line strings
	const yamlOutput: string = stringify(data, {
		lineWidth: -1 // Prevent line wrapping
	});

	console.log(yamlOutput);
}

// Type for the full hierarchical data structure
type FullHierarchyUser = User & {
	topics: (Topic & {
		decks: (Deck & {
			cards: Card[];
		})[];
	})[];
};

/**
 * Get summary statistics about the database
 */
async function getSummary(): Promise<void> {
	const userCount: number = await prisma.user.count();
	const topicCount: number = await prisma.topic.count();
	const deckCount: number = await prisma.deck.count();
	const cardCount: number = await prisma.card.count();
	const now: Date = new Date();

	// Format timestamp directly to avoid colon issues
	const timestamp: string = now.toISOString();

	const summaryResult: SummaryResult = {
		users: userCount,
		topics: topicCount,
		decks: deckCount,
		cards: cardCount,
		timestamp: timestamp
	};

	output(summaryResult);
}

/**
 * List all users
 */
async function listUsers(): Promise<void> {
	const usersQuery: Prisma.UserFindManyArgs = {
		orderBy: { id: 'asc' } // Always sort by ID in ascending order
	};

	if (options.limit !== null) {
		usersQuery.take = options.limit;
	}

	const users: User[] = await prisma.user.findMany(usersQuery);
	output(users);
}

/**
 * List topics, optionally filtered by user ID
 */
async function listTopics(): Promise<void> {
	const topicsQuery: Prisma.TopicFindManyArgs = {
		include: {
			decks: {
				orderBy: { id: 'asc' } // Sort decks by ID
			}
		},
		orderBy: { id: 'asc' } // Sort topics by ID
	};

	if (options.limit !== null) {
		topicsQuery.take = options.limit;
	}

	if (param && !isNaN(parseInt(param))) {
		topicsQuery.where = { userId: parseInt(param) };
	}

	// We need to use a type assertion to help TypeScript
	const topics = (await prisma.topic.findMany(topicsQuery)) as (Topic & {
		decks: Deck[];
	})[];
	output(topics);
}

/**
 * List decks, optionally filtered by topic ID
 */
async function listDecks(): Promise<void> {
	const decksQuery: Prisma.DeckFindManyArgs = {
		include: {
			cards: {
				orderBy: { id: 'asc' } // Sort cards by ID
			}
		},
		orderBy: { id: 'asc' } // Sort decks by ID
	};

	if (options.limit !== null) {
		decksQuery.take = options.limit;
	}

	if (param && !isNaN(parseInt(param))) {
		decksQuery.where = { topicId: parseInt(param) };
	}

	// Use type assertion to help TypeScript understand the return type
	const decks = (await prisma.deck.findMany(decksQuery)) as (Deck & {
		cards: Card[];
	})[];
	output(decks);
}

/**
 * List cards, optionally filtered by deck ID and due status
 */
async function listCards(): Promise<void> {
	const cardsQuery: Prisma.CardFindManyArgs = {
		include: {
			schedules: {
				where: { isReversed: false } // Get forward schedule
			}
		},
		orderBy: { id: 'asc' } // Sort cards by ID
	};

	if (options.limit !== null) {
		cardsQuery.take = options.limit;
	}

	if (param && !isNaN(parseInt(param))) {
		cardsQuery.where = { deckId: parseInt(param) };
	}

	const cards = (await prisma.card.findMany(cardsQuery)) as (Card & {
		schedules: {
			lastSeen: Date | null;
			grade: string | null;
			repCount: number;
			easiness: number;
			interval: number;
		}[];
	})[];

	// Create scheduling data from cards + schedules
	const cardsWithScheduleData = cards.map((card) => {
		const forwardSchedule = card.schedules[0];
		return {
			...card,
			lastSeen: forwardSchedule?.lastSeen ?? null,
			grade: forwardSchedule?.grade ?? null,
			repCount: forwardSchedule?.repCount ?? 0,
			easiness: forwardSchedule?.easiness ?? 2.5,
			interval: forwardSchedule?.interval ?? 1
		};
	});

	// Filter cards to only show those due today if --due flag is set
	let displayCards = cardsWithScheduleData;
	if (options.due) {
		displayCards = displayCards.filter((card) => isCardDue(card as CardSchedulingData));
	}

	output(displayCards);
}

/**
 * Get details for a specific card
 */
async function getCard(): Promise<void> {
	if (!param || isNaN(parseInt(param))) {
		console.error('Error: Card ID is required');
		process.exit(1);
	}

	const cardId: number = parseInt(param);
	const card: Card | null = await prisma.card.findUnique({
		where: { id: cardId }
	});

	if (!card) {
		console.error(`Error: Card with ID ${cardId} not found`);
		process.exit(1);
	}

	// Modified to return the card as an array with a single element
	// instead of a single object, for consistency with the cards command
	output([card]);
}

/**
 * Search for cards containing the specified text
 */
async function searchCards(): Promise<void> {
	if (!param) {
		console.error('Error: Search text is required');
		process.exit(1);
	}

	const searchQuery: Prisma.CardFindManyArgs = {
		where: {
			OR: [
				{ front: { contains: param, mode: 'insensitive' } },
				{ back: { contains: param, mode: 'insensitive' } },
				{ note: { contains: param, mode: 'insensitive' } }
			]
		},
		include: {
			schedules: {
				where: { isReversed: false } // Get forward schedule
			}
		},
		orderBy: { id: 'asc' } // Sort search results by ID
	};

	if (options.limit !== null) {
		searchQuery.take = options.limit;
	}

	const searchResults = (await prisma.card.findMany(searchQuery)) as (Card & {
		schedules: {
			lastSeen: Date | null;
			grade: string | null;
			repCount: number;
			easiness: number;
			interval: number;
		}[];
	})[];

	// Create scheduling data from cards + schedules
	const searchResultsWithScheduleData = searchResults.map((card) => {
		const forwardSchedule = card.schedules[0];
		return {
			...card,
			lastSeen: forwardSchedule?.lastSeen ?? null,
			grade: forwardSchedule?.grade ?? null,
			repCount: forwardSchedule?.repCount ?? 0,
			easiness: forwardSchedule?.easiness ?? 2.5,
			interval: forwardSchedule?.interval ?? 1
		};
	});

	// Filter search results by due status if --due flag is set
	let displayResults = searchResultsWithScheduleData;
	if (options.due) {
		displayResults = displayResults.filter((card) => isCardDue(card as CardSchedulingData));
	}

	output(displayResults);
}

/**
 * Display all data in a hierarchical structure
 */
async function displayAllData(): Promise<void> {
	// Standard hierarchical export with sorting at each level
	const allData: FullHierarchyUser[] = await prisma.user.findMany({
		include: {
			topics: {
				orderBy: { id: 'asc' }, // Sort topics by ID
				include: {
					decks: {
						orderBy: { id: 'asc' }, // Sort decks by ID
						include: {
							cards: {
								orderBy: { id: 'asc' } // Sort cards by ID
							}
						}
					}
				}
			}
		},
		orderBy: { id: 'asc' } // Sort users by ID
	});

	// Output all data in hierarchical format
	output(allData);
}

/**
 * Display help information
 */
function displayHelp(): void {
	console.log(`
Cadence Cards Data Viewer

Usage:
  npx tsx scripts/view-data.ts [command] [options]

Commands:
  summary            - Show summary statistics
  users              - List all users
  topics [userId]    - List all topics, optionally filtered by user ID
  decks [topicId]    - List all decks, optionally filtered by topic ID
  cards [deckId]     - List all cards, optionally filtered by deck ID
  card [cardId]      - Show details for a specific card (outputs as an array)
  search [text]      - Search card fronts and backs for text
  all                - Display all data

Options:
  --limit=N          - Limit results to N items (default: all)
  --due              - Filter cards to show only those due today

Examples:
  npx tsx scripts/view-data.ts all
  npx tsx scripts/view-data.ts search español
  npx tsx scripts/view-data.ts cards --limit=20
  npx tsx scripts/view-data.ts cards --due
  npx tsx scripts/view-data.ts cards 1 --due
  npx tsx scripts/view-data.ts search conjugation --due
  `);
}

// Main function
async function main(): Promise<void> {
	try {
		switch (command) {
			case 'summary':
				await getSummary();
				break;
			case 'users':
				await listUsers();
				break;
			case 'topics':
				await listTopics();
				break;
			case 'decks':
				await listDecks();
				break;
			case 'cards':
				await listCards();
				break;
			case 'card':
				await getCard();
				break;
			case 'search':
				await searchCards();
				break;
			case 'all':
				await displayAllData();
				break;
			default:
				displayHelp();
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		// Check if this is a "table does not exist" error
		if (errorMessage.includes('does not exist in the current database')) {
			console.error('\n❌ Database Error: Tables have not been created yet.\n');
			console.error('To fix this, run the following commands:\n');
			console.error('  ./manage.py shell --service web');
			console.error('  npx prisma migrate dev\n');
			console.error('Or run directly:');
			console.error('  docker compose exec web npx prisma migrate dev\n');
			process.exit(1);
		}

		// Generic error handling for other errors
		console.error('Error:', errorMessage);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
