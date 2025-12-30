/**
 * Script to add new flashcards from a YAML file to a specified deck
 *
 * Usage:
 *   npx tsx scripts/add-cards.ts <yaml-file-path> <deck-id>
 *
 * Example:
 *   npx tsx scripts/add-cards.ts tmp/new-cards.yaml 1
 */

import { PrismaClient, Card, CardPriority, CardGrade, Schedule } from '@prisma/client';
import * as fs from 'fs';
import { parse } from 'yaml';

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Interface representing card data from the YAML file
 * Note: SM-2 scheduling data (LastSeen, Grade, RepCount, Easiness, Interval)
 * is now stored in the Schedule table, not the Card table
 */
interface YamlCard {
	ID?: number | null; // Optional ID field - may be null or undefined
	Front: string;
	Back: string;
	Note?: string | null;
	Priority: 'A' | 'B' | 'C';
	// SM-2 fields for forward direction - will be stored in Schedule table
	Grade?: string | null;
	RepCount?: number;
	Easiness?: number;
	Interval?: number;
	Tags?: string[];
	LastSeen?: string | null;
	// SM-2 fields for reverse direction (for bidirectional decks)
	ReverseGrade?: string | null;
	ReverseRepCount?: number;
	ReverseEasiness?: number;
	ReverseInterval?: number;
	ReverseLastSeen?: string | null;
}

/**
 * Initial SM-2 state for new schedules
 */
const INITIAL_SM2_STATE = {
	repCount: 0,
	easiness: 2.5,
	interval: 1
};

/**
 * Custom error for YAML file reading issues
 */
class YamlReadError extends Error {
	constructor(
		message: string,
		public readonly filePath: string
	) {
		super(`YAML read error at ${filePath}: ${message}`);
		this.name = 'YamlReadError';
	}
}

/**
 * Custom error for database operations
 */
class DatabaseOperationError extends Error {
	constructor(
		message: string,
		public readonly operation: string
	) {
		super(`Database operation "${operation}" failed: ${message}`);
		this.name = 'DatabaseOperationError';
	}
}

/**
 * Read and parse a YAML file
 * @param filePath - The path to the YAML file
 * @returns The parsed YAML content as an array of YamlCard
 * @throws YamlReadError if the file cannot be read or parsed
 */
function readYamlFile(filePath: string): YamlCard[] {
	try {
		const fileContents: string = fs.readFileSync(filePath, 'utf8');
		const parsedContent: YamlCard[] = parse(fileContents) as YamlCard[];
		return parsedContent;
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		throw new YamlReadError(errorMessage, filePath);
	}
}

/**
 * Convert a YAML card to a Prisma Create Input format
 * Importantly, this doesn't include the ID field for creation
 */
/**
 * Validate and map grade values to valid CardGrade enum values
 */
function mapGradeValue(grade: string | null | undefined): CardGrade | null {
	if (!grade) return null;

	// Check if it's already a valid enum value
	if (['INCORRECT', 'CORRECT_WITH_HESITATION', 'CORRECT_PERFECT_RECALL'].includes(grade)) {
		return grade as CardGrade;
	}

	// Map legacy or alternative grade values to valid ones
	switch (grade.toUpperCase()) {
		case 'WRONG_COMPLETE_BLACKOUT':
		case 'BLACKOUT':
		case 'WRONG':
		case '0':
			return 'INCORRECT';

		case 'CORRECT_WITH_DIFFICULTY':
		case 'HESITATION':
		case '1':
			return 'CORRECT_WITH_HESITATION';

		case 'CORRECT_EASY_RECALL':
		case 'PERFECT':
		case '2':
			return 'CORRECT_PERFECT_RECALL';

		default:
			console.warn(`Warning: Invalid grade value "${grade}" - using null instead`);
			return null;
	}
}

/**
 * Create card data from YAML (content fields only, not SM-2 scheduling)
 */
function createCardDataFromYaml(yamlCard: YamlCard, deckId: number) {
	// Validate priority
	let priority: CardPriority = 'A';
	if (yamlCard.Priority && ['A', 'B', 'C'].includes(yamlCard.Priority)) {
		priority = yamlCard.Priority as CardPriority;
	} else {
		console.warn(`Warning: Invalid priority "${yamlCard.Priority}" - using "A" instead`);
	}

	return {
		front: yamlCard.Front,
		back: yamlCard.Back,
		note: yamlCard.Note ?? null,
		priority: priority,
		tags: yamlCard.Tags ?? [],
		deckId: deckId
	};
}

/**
 * Create schedule data from YAML (SM-2 scheduling fields)
 */
function createScheduleDataFromYaml(yamlCard: YamlCard) {
	return {
		lastSeen: yamlCard.LastSeen ? new Date(yamlCard.LastSeen) : null,
		grade: mapGradeValue(yamlCard.Grade),
		repCount: yamlCard.RepCount ?? INITIAL_SM2_STATE.repCount,
		easiness: yamlCard.Easiness ?? INITIAL_SM2_STATE.easiness,
		interval: yamlCard.Interval ?? INITIAL_SM2_STATE.interval,
		isReversed: false
	};
}

/**
 * Create reverse schedule data from YAML (SM-2 scheduling fields for reverse direction)
 */
function createReverseScheduleDataFromYaml(yamlCard: YamlCard) {
	return {
		lastSeen: yamlCard.ReverseLastSeen ? new Date(yamlCard.ReverseLastSeen) : null,
		grade: mapGradeValue(yamlCard.ReverseGrade),
		repCount: yamlCard.ReverseRepCount ?? INITIAL_SM2_STATE.repCount,
		easiness: yamlCard.ReverseEasiness ?? INITIAL_SM2_STATE.easiness,
		interval: yamlCard.ReverseInterval ?? INITIAL_SM2_STATE.interval,
		isReversed: true
	};
}

/**
 * Add a card from YAML to the database with its schedule
 * Creates card and schedule in a single transaction
 */
async function createCard(
	yamlCard: YamlCard,
	deckId: number,
	isBidirectional: boolean
): Promise<Card & { schedules: Schedule[] }> {
	try {
		const cardData = createCardDataFromYaml(yamlCard, deckId);
		const forwardScheduleData = createScheduleDataFromYaml(yamlCard);

		// Build schedules array - forward direction always, reverse if bidirectional
		const schedulesToCreate = [forwardScheduleData];
		if (isBidirectional) {
			// Use reverse schedule data from YAML if available, otherwise use initial state
			const reverseScheduleData = createReverseScheduleDataFromYaml(yamlCard);
			schedulesToCreate.push(reverseScheduleData);
		}

		// Create the card with schedules in a single operation
		const card = await prisma.card.create({
			data: {
				...cardData,
				schedules: {
					create: schedulesToCreate
				}
			},
			include: { schedules: true }
		});

		return card;
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		throw new DatabaseOperationError(errorMessage, `createCard for front: ${yamlCard.Front}`);
	}
}

/**
 * Process a YAML file and add all cards to the specified deck
 */
async function processYamlFile(yamlPath: string, deckId: number): Promise<number> {
	try {
		// Check if deck exists and get bidirectional setting
		const deck = await prisma.deck.findUnique({
			where: { id: deckId }
		});

		if (!deck) {
			throw new Error(`Deck with ID ${deckId} does not exist`);
		}

		console.log(`Deck "${deck.name}" (bidirectional: ${deck.isBidirectional})`);

		// Read the YAML file
		const cards = readYamlFile(yamlPath);
		console.log(`Loaded ${cards.length} cards from YAML file: ${yamlPath}`);

		// Create each card in the database
		let addedCount = 0;
		for (const yamlCard of cards) {
			const card = await createCard(yamlCard, deckId, deck.isBidirectional);
			addedCount++;
			const scheduleInfo = deck.isBidirectional
				? '(2 schedules: forward + reverse)'
				: '(1 schedule: forward)';
			console.log(`Added card ${addedCount}/${cards.length}: ${card.front} ${scheduleInfo}`);
		}

		return addedCount;
	} catch (error) {
		if (error instanceof YamlReadError) {
			console.error(`Failed to read YAML file: ${error.message}`);
		} else if (error instanceof DatabaseOperationError) {
			console.error(`Database operation failed: ${error.message}`);
		} else {
			console.error(`Unknown error: ${error instanceof Error ? error.message : String(error)}`);
		}
		throw error;
	}
}

/**
 * Main function
 */
async function main() {
	try {
		// Get command line arguments
		const args = process.argv.slice(2);

		if (args.length < 2) {
			console.error('Usage: npx tsx scripts/add-cards.ts <yaml-file-path> <deck-id>');
			process.exit(1);
		}

		const yamlPath = args[0];
		const deckId = parseInt(args[1], 10);

		if (isNaN(deckId)) {
			console.error('Error: Deck ID must be a number');
			process.exit(1);
		}

		// Process the YAML file
		const addedCount = await processYamlFile(yamlPath, deckId);
		console.log(`Added ${addedCount} cards to the database`);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

// Execute the main function
main();
