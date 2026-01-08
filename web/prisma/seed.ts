import { PrismaClient, User, Topic, Deck, Card, Schedule, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { hashPassword } from '../src/lib/server/password';
import { Grade, Priority } from '@/lib/sm2';

// Initialize Prisma client
const prisma: PrismaClient = new PrismaClient();

/**
 * Interface representing card data from the YAML file
 * Note: SM-2 scheduling data (LastSeen, Grade, RepCount, Easiness, Interval)
 * is now stored in the Schedule table, not the Card table
 */
interface YamlCard {
	ID: number;
	Topic: string;
	Front: string;
	Back: string;
	LastSeen: string | null; // Stored in Schedule
	Priority: Priority;
	Grade: Grade | null; // Stored in Schedule
	RepCount: number; // Stored in Schedule
	Easiness: number; // Stored in Schedule
	Interval: number; // Stored in Schedule
	Tags: string[];
	Note: string | null;
}

/**
 * Interface for the result of the seeding process
 */
interface SeedResult {
	user: User;
	topic: Topic;
	deck: Deck;
	cardsAdded: number;
	startTime: Date;
	endTime: Date;
	executionTimeMs: number;
}

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
 * Convert a YAML card to a Prisma CardCreateInput (content fields only)
 * SM-2 scheduling data is stored separately in the Schedule table
 * @param yamlCard - The source YAML card data
 * @param deckId - The ID of the deck to associate with the card
 * @returns The Prisma-compatible card creation data
 */
function createCardDataFromYaml(
	yamlCard: YamlCard,
	deckId: number
): Prisma.CardUncheckedCreateInput {
	return {
		id: yamlCard.ID,
		front: yamlCard.Front,
		back: yamlCard.Back,
		note: yamlCard.Note,
		priority: yamlCard.Priority,
		tags: yamlCard.Tags,
		deckId: deckId,
		createdAt: new Date(),
		updatedAt: new Date()
	};
}

/**
 * Create schedule data from YAML card (SM-2 scheduling fields)
 */
function createScheduleDataFromYaml(yamlCard: YamlCard): {
	lastSeen: Date | null;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
	isReversed: boolean;
} {
	return {
		lastSeen: yamlCard.LastSeen ? new Date(yamlCard.LastSeen) : null,
		grade: yamlCard.Grade,
		repCount: yamlCard.RepCount,
		easiness: yamlCard.Easiness,
		interval: yamlCard.Interval,
		isReversed: false
	};
}

/**
 * Update data for a card from YAML (content fields only)
 * @param yamlCard - The source YAML card data
 * @returns The Prisma-compatible card update data
 */
function updateCardDataFromYaml(yamlCard: YamlCard): Prisma.CardUpdateInput {
	return {
		front: yamlCard.Front,
		back: yamlCard.Back,
		note: yamlCard.Note,
		priority: yamlCard.Priority,
		tags: yamlCard.Tags,
		updatedAt: new Date()
	};
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
		const parsedContent: YamlCard[] = parse(fileContents) as YamlCard[]; // Use parse from yaml package
		return parsedContent;
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		throw new YamlReadError(errorMessage, filePath);
	}
}

/**
 * Create a user in the database
 * @param email - The user's email address
 * @param name - The user's name
 * @param password - The user's password (should be hashed in production)
 * @returns The created or updated User record
 * @throws DatabaseOperationError if the user cannot be created
 */
async function createUser(email: string, name: string, password: string): Promise<User> {
	try {
		// Hash the password with bcrypt
		const hashedPassword = await hashPassword(password);

		const userData: Prisma.UserCreateInput = {
			email,
			name,
			password: hashedPassword // Store the hashed password
		};

		const user: User = await prisma.user.upsert({
			where: { email },
			update: {
				password: hashedPassword,
				name
			},
			create: userData
		});

		return user;
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		throw new DatabaseOperationError(errorMessage, 'createUser');
	}
}

/**
 * Create a topic for a user
 * @param name - The topic name
 * @param userId - The ID of the user owning the topic
 * @returns The created or updated Topic record
 * @throws DatabaseOperationError if the topic cannot be created
 */
async function createTopic(name: string, userId: number): Promise<Topic> {
	try {
		const topicData: Prisma.TopicCreateInput = {
			name,
			user: {
				connect: {
					id: userId
				}
			}
		};

		const topic: Topic = await prisma.topic.upsert({
			where: {
				name_userId: {
					name,
					userId
				}
			},
			update: {},
			create: topicData
		});

		return topic;
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		throw new DatabaseOperationError(errorMessage, 'createTopic');
	}
}

/**
 * Create a deck for a topic
 * @param name - The deck name
 * @param topicId - The ID of the topic for this deck
 * @returns The created or updated Deck record
 * @throws DatabaseOperationError if the deck cannot be created
 */
async function createDeck(name: string, topicId: number): Promise<Deck> {
	try {
		const deckData: Prisma.DeckCreateInput = {
			name,
			topic: {
				connect: {
					id: topicId
				}
			}
		};

		const deck: Deck = await prisma.deck.upsert({
			where: {
				name_topicId: {
					name,
					topicId
				}
			},
			update: {},
			create: deckData
		});

		return deck;
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		throw new DatabaseOperationError(errorMessage, 'createDeck');
	}
}

/**
 * Create a card in the database with its schedule
 * @param yamlCard - The source YAML card data
 * @param deckId - The ID of the deck this card belongs to
 * @returns The created or updated Card record with schedules
 * @throws DatabaseOperationError if the card cannot be created
 */
async function createCard(
	yamlCard: YamlCard,
	deckId: number
): Promise<Card & { schedules: Schedule[] }> {
	try {
		// Check if card already exists
		const existingCard = await prisma.card.findUnique({
			where: { id: yamlCard.ID },
			include: { schedules: true }
		});

		if (existingCard) {
			// Update existing card and its forward schedule
			const updatedCard = await prisma.card.update({
				where: { id: yamlCard.ID },
				data: updateCardDataFromYaml(yamlCard),
				include: { schedules: true }
			});

			// Update the forward schedule if it exists
			const forwardSchedule = updatedCard.schedules.find((s) => !s.isReversed);
			if (forwardSchedule) {
				await prisma.schedule.update({
					where: { id: forwardSchedule.id },
					data: {
						lastSeen: yamlCard.LastSeen ? new Date(yamlCard.LastSeen) : null,
						grade: yamlCard.Grade,
						repCount: yamlCard.RepCount,
						easiness: yamlCard.Easiness,
						interval: yamlCard.Interval
					}
				});
			}

			return prisma.card.findUnique({
				where: { id: yamlCard.ID },
				include: { schedules: true }
			}) as Promise<Card & { schedules: Schedule[] }>;
		}

		// Create new card with forward schedule
		const card = await prisma.card.create({
			data: {
				...createCardDataFromYaml(yamlCard, deckId),
				schedules: {
					create: [createScheduleDataFromYaml(yamlCard)]
				}
			},
			include: { schedules: true }
		});

		return card;
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		throw new DatabaseOperationError(errorMessage, `createCard for ID ${yamlCard.ID}`);
	}
}

/**
 * Synchronize the database sequences after importing data with explicit IDs
 * This ensures that auto-increment will generate unique IDs moving forward
 */
async function syncSequences(): Promise<void> {
	try {
		// Sync Card sequence
		await prisma.$executeRawUnsafe(
			`SELECT setval('"Card_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "Card"), true);`
		);
		console.log(`Card sequence synchronized to the highest ID in the table`);

		// Sync Schedule sequence
		await prisma.$executeRawUnsafe(
			`SELECT setval('"Schedule_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "Schedule"), true);`
		);
		console.log(`Schedule sequence synchronized to the highest ID in the table`);

		// Sync other sequences if needed
		await prisma.$executeRawUnsafe(
			`SELECT setval('"Deck_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "Deck"), true);`
		);
		console.log(`Deck sequence synchronized to the highest ID in the table`);

		await prisma.$executeRawUnsafe(
			`SELECT setval('"Topic_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "Topic"), true);`
		);
		console.log(`Topic sequence synchronized to the highest ID in the table`);

		await prisma.$executeRawUnsafe(
			`SELECT setval('"User_id_seq"', (SELECT COALESCE(MAX(id), 0) FROM "User"), true);`
		);
		console.log(`User sequence synchronized to the highest ID in the table`);
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : String(error);
		throw new DatabaseOperationError(errorMessage, 'syncSequences');
	}
}

/**
 * Seed the database with initial data
 * @returns A result object with information about what was created
 * @throws Various errors based on what fails during seeding
 */
async function main(): Promise<SeedResult> {
	const startTime: Date = new Date();
	console.log(`Starting seed process at ${startTime.toISOString()}`);

	// 1. Create a user
	const user: User = await createUser('sean@alexan.org', 'Sean', '');
	console.log(`Created user: ${user.name} (${user.email}) with ID ${user.id}`);

	// 2. Create a "Spanish" topic for the user
	const topic: Topic = await createTopic('Spanish', user.id);
	console.log(`Created topic: ${topic.name} with ID ${topic.id}`);

	// 3. Create a default deck
	const deck: Deck = await createDeck('Vocabulary', topic.id);
	console.log(`Created deck: ${deck.name} with ID ${deck.id}`);

	// 4. Load cards from YAML file
	let cardsAdded: number = 0;
	try {
		// Path to the YAML file containing card data
		//const yamlPath: string = path.join(__dirname, '../data/sc2-sample-02.yaml');
		const yamlPath: string = path.join(__dirname, '../data/all-cards-250226a.yaml');
		const cards: YamlCard[] = readYamlFile(yamlPath);
		console.log(`Loaded ${cards.length} cards from YAML file: ${yamlPath}`);

		// Create each card in the database
		for (const yamlCard of cards) {
			const card: Card = await createCard(yamlCard, deck.id);
			cardsAdded++;
			console.log(`Added card ${cardsAdded}/${cards.length}: ${card.front}`);
		}
		console.log(`Added ${cardsAdded} cards to the database`);

		// Synchronize sequences to prevent future ID conflicts
		await syncSequences();
	} catch (error: unknown) {
		if (error instanceof YamlReadError) {
			console.error(`Failed to read YAML file: ${error.message}`);
		} else if (error instanceof DatabaseOperationError) {
			console.error(`Database operation failed: ${error.message}`);
		} else {
			console.error(`Unknown error: ${error instanceof Error ? error.message : String(error)}`);
		}
		throw error; // Re-throw to be caught by the outer catch
	}

	const endTime: Date = new Date();
	const executionTimeMs: number = endTime.getTime() - startTime.getTime();
	console.log(
		`Seed process completed successfully in ${executionTimeMs}ms at ${endTime.toISOString()}`
	);

	// Return a summary of what was created
	return {
		user,
		topic,
		deck,
		cardsAdded,
		startTime,
		endTime,
		executionTimeMs
	};
}

/**
 * Execute the main seeding function and handle errors
 */
main()
	.then((result: SeedResult): void => {
		console.log(`Seeding summary:`);
		console.log(`- User created: ${result.user.name} (ID: ${result.user.id})`);
		console.log(`- Topic created: ${result.topic.name} (ID: ${result.topic.id})`);
		console.log(`- Deck created: ${result.deck.name} (ID: ${result.deck.id})`);
		console.log(`- Cards added: ${result.cardsAdded}`);
		console.log(`- Started at: ${result.startTime.toISOString()}`);
		console.log(`- Finished at: ${result.endTime.toISOString()}`);
		console.log(`- Execution time: ${result.executionTimeMs}ms`);
	})
	.catch((e: unknown): void => {
		const errorMessage: string = e instanceof Error ? `${e.name}: ${e.message}` : String(e);

		console.error('Seeding failed with error:');
		console.error(errorMessage);

		if (e instanceof Error && e.stack) {
			console.error('Stack trace:');
			console.error(e.stack);
		}

		process.exit(1);
	})
	.finally(async (): Promise<void> => {
		// Always disconnect from Prisma client
		await prisma.$disconnect();
	});
