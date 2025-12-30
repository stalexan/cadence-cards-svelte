import { prisma } from '$lib/server/db';
import { Prisma } from '@prisma/client';

/**
 * Parameters for creating a new deck
 */
export interface CreateDeckParams {
	userId: number;
	name: string;
	topicId: number;
	field1Label?: string;
	field2Label?: string;
	isBidirectional?: boolean;
}

/**
 * Parameters for updating a deck
 */
export interface UpdateDeckParams {
	name?: string;
	topicId?: number;
	field1Label?: string | null;
	field2Label?: string | null;
	isBidirectional?: boolean;
}

/**
 * Formatted deck with topic information
 */
export interface FormattedDeck {
	id: number;
	name: string;
	field1Label: string | null;
	field2Label: string | null;
	isBidirectional: boolean;
	topicId: number;
	topicName: string;
	createdAt: Date;
	updatedAt: Date;
	cardCount?: number;
}

/**
 * Service class for deck-related business logic
 */
export class DeckService {
	/**
	 * Get all decks for a user with optional topic filter
	 */
	async getDecks(userId: number, topicId?: number): Promise<FormattedDeck[]> {
		// Build where clause
		const whereClause: {
			topic: { userId: number };
			topicId?: number;
		} = {
			topic: {
				userId: userId
			}
		};

		if (topicId) {
			whereClause.topicId = topicId;
		}

		// Fetch decks with topic info and card counts
		const decksWithCounts = await prisma.deck.findMany({
			where: whereClause,
			include: {
				topic: {
					select: {
						name: true
					}
				},
				_count: {
					select: {
						cards: true
					}
				}
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		// Format the response to match the expected structure
		return decksWithCounts.map((deck) => ({
			id: deck.id,
			name: deck.name,
			field1Label: deck.field1Label,
			field2Label: deck.field2Label,
			isBidirectional: deck.isBidirectional,
			topicId: deck.topicId,
			topicName: deck.topic.name,
			createdAt: deck.createdAt,
			updatedAt: deck.updatedAt,
			cardCount: deck._count.cards
		}));
	}

	/**
	 * Get a single deck by ID with ownership verification
	 */
	async getDeckById(deckId: number, userId: number): Promise<FormattedDeck> {
		const deck = await prisma.deck.findFirst({
			where: {
				id: deckId,
				topic: {
					userId
				}
			},
			include: {
				topic: {
					select: {
						id: true,
						name: true
					}
				}
			}
		});

		if (!deck) {
			throw new Error('Deck not found or does not belong to the user');
		}

		return {
			id: deck.id,
			name: deck.name,
			field1Label: deck.field1Label,
			field2Label: deck.field2Label,
			isBidirectional: deck.isBidirectional,
			topicId: deck.topicId,
			topicName: deck.topic.name,
			createdAt: deck.createdAt,
			updatedAt: deck.updatedAt
		};
	}

	/**
	 * Create a new deck
	 * Uses transaction to atomically check authorization and create deck
	 * Relies on database unique constraint @@unique([name, topicId]) for duplicate detection
	 */
	async createDeck(params: CreateDeckParams) {
		const { userId, name, topicId, field1Label, field2Label, isBidirectional } = params;

		try {
			// Use transaction to atomically check authorization and create deck
			const deck = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
				// Check if the topic exists and belongs to the user (authorization check)
				const topic = await tx.topic.findFirst({
					where: {
						id: topicId,
						userId
					}
				});

				if (!topic) {
					throw new Error('Topic not found or does not belong to the user');
				}

				// Create the new deck - database will enforce name uniqueness atomically
				return await tx.deck.create({
					data: {
						name,
						topicId,
						field1Label: field1Label || null,
						field2Label: field2Label || null,
						isBidirectional: isBidirectional ?? false
					}
				});
			});

			return deck;
		} catch (error: unknown) {
			// Handle unique constraint violation
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002' &&
				error.meta?.target &&
				Array.isArray(error.meta.target) &&
				error.meta.target.includes('name')
			) {
				throw new Error('A deck with this name already exists in this topic');
			}
			throw error;
		}
	}

	/**
	 * Update an existing deck
	 * Uses transaction to atomically check authorization and update deck
	 * Relies on database unique constraint @@unique([name, topicId]) for duplicate detection
	 * When enabling bidirectional, creates reverse schedules for cards that don't have one
	 */
	async updateDeck(
		deckId: number,
		userId: number,
		updateData: UpdateDeckParams
	): Promise<FormattedDeck> {
		try {
			// Use transaction to atomically check authorization and update deck
			const updatedDeck = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
				// Check if deck exists and belongs to the user (authorization check)
				const existingDeck = await tx.deck.findFirst({
					where: {
						id: deckId,
						topic: {
							userId
						}
					},
					include: {
						topic: true
					}
				});

				if (!existingDeck) {
					throw new Error('Deck not found or does not belong to the user');
				}

				// If topicId is provided, ensure it belongs to the user
				if (updateData.topicId && updateData.topicId !== existingDeck.topicId) {
					const newTopic = await tx.topic.findFirst({
						where: {
							id: updateData.topicId,
							userId
						}
					});

					if (!newTopic) {
						throw new Error('New topic not found or does not belong to the user');
					}
				}

				const finalTopicId = updateData.topicId || existingDeck.topicId;

				// If enabling bidirectional, create reverse schedules for cards that don't have one
				if (updateData.isBidirectional === true && !existingDeck.isBidirectional) {
					const cardsWithoutReverse = await tx.card.findMany({
						where: {
							deckId,
							schedules: { none: { isReversed: true } }
						}
					});

					if (cardsWithoutReverse.length > 0) {
						await tx.schedule.createMany({
							data: cardsWithoutReverse.map((card) => ({
								cardId: card.id,
								isReversed: true
							}))
						});
					}
				}
				// Note: When disabling bidirectional, reverse schedules stay dormant (preserved)

				// Update the deck - database will enforce name uniqueness atomically
				return await tx.deck.update({
					where: { id: deckId },
					data: {
						name: updateData.name,
						field1Label: updateData.field1Label,
						field2Label: updateData.field2Label,
						isBidirectional: updateData.isBidirectional,
						topicId: finalTopicId
					},
					include: {
						topic: {
							select: {
								name: true
							}
						}
					}
				});
			});

			// Format the response
			return {
				id: updatedDeck.id,
				name: updatedDeck.name,
				field1Label: updatedDeck.field1Label,
				field2Label: updatedDeck.field2Label,
				isBidirectional: updatedDeck.isBidirectional,
				topicId: updatedDeck.topicId,
				topicName: updatedDeck.topic.name,
				createdAt: updatedDeck.createdAt,
				updatedAt: updatedDeck.updatedAt
			};
		} catch (error: unknown) {
			// Handle unique constraint violation
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002' &&
				error.meta?.target &&
				Array.isArray(error.meta.target) &&
				error.meta.target.includes('name')
			) {
				throw new Error('A deck with this name already exists in this topic');
			}
			throw error;
		}
	}

	/**
	 * Delete a deck
	 */
	async deleteDeck(deckId: number, userId: number): Promise<void> {
		// Check if deck exists and belongs to the user
		const existingDeck = await prisma.deck.findFirst({
			where: {
				id: deckId,
				topic: {
					userId
				}
			}
		});

		if (!existingDeck) {
			throw new Error('Deck not found or does not belong to the user');
		}

		// Delete the deck (cascading deletion will remove associated cards)
		await prisma.deck.delete({
			where: { id: deckId }
		});
	}
}

// Export a singleton instance
export const deckService = new DeckService();
