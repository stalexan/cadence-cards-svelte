import { prisma } from '$lib/server/db';
import { Prisma } from '@prisma/client';
import { importCardsFromYaml, convertYamlCardsToDatabaseFormat } from '$lib/yaml-utils';

/**
 * Parameters for importing cards
 */
export interface ImportCardsParams {
	userId: number;
	deckId: number;
	yamlContent: string;
}

/**
 * Result of card import operation
 */
export interface ImportResult {
	success: boolean;
	message: string;
	importedCount: number;
	failedCount: number;
	errors: string[];
	deckName?: string;
}

/**
 * Service class for import-related business logic
 */
export class ImportService {
	/**
	 * Import cards from YAML content into a deck
	 * Uses transaction to atomically check authorization and import cards
	 */
	async importCards(params: ImportCardsParams): Promise<ImportResult> {
		const { userId, deckId, yamlContent } = params;

		// Parse and validate YAML content (can happen outside transaction - pure computation)
		const { valid: validCards, invalid: invalidCards } = importCardsFromYaml(yamlContent);

		if (validCards.length === 0) {
			return {
				success: false,
				message: 'No valid cards found in the import file',
				importedCount: 0,
				failedCount: invalidCards.length,
				errors: invalidCards.map((item) => item.error)
			};
		}

		// Convert cards to database format
		const cardsToCreate = convertYamlCardsToDatabaseFormat(validCards, deckId);

		try {
			// Use transaction to atomically check authorization and import cards
			const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
				// Check if deck exists and belongs to the user (authorization check)
				const deck = await tx.deck.findFirst({
					where: {
						id: deckId,
						topic: {
							userId
						}
					}
				});

				if (!deck) {
					throw new Error('Deck not found or does not belong to the user');
				}

				// Create cards individually with their schedules
				// (createMany doesn't support nested creates)
				let importedCount = 0;
				for (const cardData of cardsToCreate) {
					// Build schedule data for forward direction
					const forwardSchedule = {
						isReversed: false,
						lastSeen: cardData.lastSeen,
						grade: cardData.grade,
						repCount: cardData.repCount,
						easiness: cardData.easiness,
						interval: cardData.interval
					};

					const schedulesToCreate = [forwardSchedule];

					// Add reverse schedule if deck is bidirectional
					if (deck.isBidirectional) {
						// Use reverse data from YAML if available, otherwise use initial values
						const hasReverseData = 'reverseLastSeen' in cardData || 'reverseGrade' in cardData;

						const reverseSchedule = {
							isReversed: true,
							lastSeen: hasReverseData ? (cardData.reverseLastSeen ?? null) : null,
							grade: hasReverseData ? (cardData.reverseGrade ?? null) : null,
							repCount: hasReverseData ? (cardData.reverseRepCount ?? 0) : 0,
							easiness: hasReverseData ? (cardData.reverseEasiness ?? 2.5) : 2.5,
							interval: hasReverseData ? (cardData.reverseInterval ?? 1) : 1
						};

						schedulesToCreate.push(reverseSchedule);
					}

					// Create card with schedules
					await tx.card.create({
						data: {
							front: cardData.front,
							back: cardData.back,
							note: cardData.note,
							priority: cardData.priority,
							tags: cardData.tags,
							deckId: cardData.deckId,
							schedules: {
								create: schedulesToCreate
							}
						}
					});

					importedCount++;
				}

				return {
					success: true,
					message: `Successfully imported ${importedCount} cards to deck "${deck.name}"`,
					importedCount,
					failedCount: invalidCards.length,
					errors: invalidCards.map((item) => item.error),
					deckName: deck.name
				};
			});

			return result;
		} catch (error: unknown) {
			// Re-throw authorization errors
			if (error instanceof Error && error.message.includes('not found or does not belong')) {
				throw error;
			}
			// Handle other errors (e.g., foreign key violations)
			throw error;
		}
	}
}

// Export a singleton instance
export const importService = new ImportService();
