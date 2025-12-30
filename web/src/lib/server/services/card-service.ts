import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';
import { Priority, Grade } from '$lib/sm2';

/**
 * Query parameters for fetching cards
 */
export interface CardQueryParams {
	userId: number;
	deckId?: number;
	topicId?: number;
	priority?: Priority;
	isDue?: boolean;
	tag?: string;
}

/**
 * Parameters for creating a new card
 */
export interface CreateCardParams {
	userId: number;
	deckId: number;
	front: string;
	back: string;
	note?: string | null;
	priority: Priority;
	tags?: string[];
	claudeAssisted?: boolean;
	instructionPrompt?: string;
}

/**
 * Parameters for updating an existing card (content only, not SM-2 data)
 */
export interface UpdateCardParams {
	front?: string;
	back?: string;
	note?: string | null;
	priority?: Priority;
	tags?: string[];
	deckId?: number;
	version?: number;
}

/**
 * Formatted card response with denormalized deck/topic info
 * Note: SM-2 scheduling data is now in the Schedule model
 */
export interface FormattedCard {
	id: number;
	front: string;
	back: string;
	note: string | null;
	priority: Priority;
	tags: string[];
	deckId: number;
	deckName: string;
	topicId: number;
	topicName: string;
	createdAt: Date;
	updatedAt: Date;
	version: number;
}

/**
 * Schedule data for a card
 */
export interface ScheduleData {
	id: number;
	isReversed: boolean;
	lastSeen: Date | null;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
	version: number;
}

/**
 * Card with schedule data for detail view
 * Includes SM-2 data from the forward schedule for backwards compatibility
 */
export interface FormattedCardWithSchedule extends FormattedCard {
	// Deck bidirectionality
	isBidirectional: boolean;
	// All schedules (forward and optionally reversed)
	schedules: ScheduleData[];
	// SM-2 data from forward schedule (for backwards compatibility)
	lastSeen: Date | null;
	grade: Grade | null;
	repCount: number;
	easiness: number;
	interval: number;
	scheduleId: number | null;
	scheduleVersion: number;
}

/**
 * Service class for card-related business logic
 */
export class CardService {
	/**
	 * Build a Prisma where clause for card queries based on filters
	 * Note: isDue filter is no longer supported here - use study-service for due cards
	 */
	private buildCardWhereClause(params: CardQueryParams): Prisma.CardWhereInput {
		const { userId, deckId, topicId, priority, tag } = params;

		const where: Prisma.CardWhereInput = {
			deck: {
				topic: {
					userId
				}
			}
		};

		if (deckId) {
			where.deckId = deckId;
		}

		if (topicId) {
			where.deck = {
				topic: {
					userId
				},
				topicId
			};
		}

		if (priority) {
			where.priority = priority;
		}

		if (tag) {
			where.tags = {
				has: tag
			};
		}

		return where;
	}

	/**
	 * Get cards with optional filters
	 * Includes forward schedule SM-2 data for backwards compatibility
	 */
	async getCards(params: CardQueryParams): Promise<FormattedCardWithSchedule[]> {
		const where = this.buildCardWhereClause(params);

		const cards = await prisma.card.findMany({
			where,
			include: {
				deck: {
					select: {
						id: true,
						name: true,
						topicId: true,
						field1Label: true,
						field2Label: true,
						isBidirectional: true,
						topic: {
							select: {
								id: true,
								name: true
							}
						}
					}
				},
				schedules: {
					where: {
						isReversed: false // Get forward schedule
					}
				}
			},
			orderBy: {
				front: 'asc'
			}
		});

		return cards.map((card) => {
			const forwardSchedule = card.schedules[0];
			const schedules: ScheduleData[] = card.schedules.map((s) => ({
				id: s.id,
				isReversed: s.isReversed,
				lastSeen: s.lastSeen,
				grade: s.grade as Grade | null,
				repCount: s.repCount,
				easiness: s.easiness,
				interval: s.interval,
				version: s.version
			}));
			return {
				id: card.id,
				front: card.front,
				back: card.back,
				note: card.note,
				priority: card.priority as Priority,
				tags: card.tags,
				deckId: card.deckId,
				deckName: card.deck.name,
				topicId: card.deck.topicId,
				topicName: card.deck.topic.name,
				createdAt: card.createdAt,
				updatedAt: card.updatedAt,
				version: card.version,
				isBidirectional: card.deck.isBidirectional,
				schedules: schedules,
				// SM-2 data from forward schedule
				lastSeen: forwardSchedule?.lastSeen ?? null,
				grade: (forwardSchedule?.grade as Grade | null) ?? null,
				repCount: forwardSchedule?.repCount ?? 0,
				easiness: forwardSchedule?.easiness ?? 2.5,
				interval: forwardSchedule?.interval ?? 1,
				scheduleId: forwardSchedule?.id ?? null,
				scheduleVersion: forwardSchedule?.version ?? 0
			};
		});
	}

	/**
	 * Create a new card with validation and logging
	 * Uses transaction to atomically check authorization and create card
	 * Creates Schedule records based on deck's isBidirectional setting
	 */
	async createCard(params: CreateCardParams) {
		const { userId, deckId, front, back, note, priority, tags, claudeAssisted, instructionPrompt } =
			params;

		// Use transaction to atomically check authorization and create card
		const card = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
			// Verify deck ownership and get bidirectional setting
			const deck = await tx.deck.findFirst({
				where: {
					id: deckId,
					topic: {
						userId
					}
				},
				include: {
					topic: {
						select: {
							name: true
						}
					}
				}
			});

			if (!deck) {
				throw new Error('Deck not found or does not belong to the user');
			}

			// Log Claude-assisted creation (outside transaction for logging)
			if (claudeAssisted) {
				console.log(`Claude-assisted card created for topic: ${deck.topic.name}`, {
					userId,
					topicId: deck.topicId,
					deckId,
					instructionPrompt: instructionPrompt || 'Not provided'
				});
			}

			// Create the card with schedules based on deck's bidirectional setting
			return await tx.card.create({
				data: {
					front,
					back,
					note,
					priority,
					tags: tags || [],
					deckId,
					schedules: {
						create: deck.isBidirectional
							? [{ isReversed: false }, { isReversed: true }]
							: [{ isReversed: false }]
					}
				},
				include: { schedules: true }
			});
		});

		return card;
	}

	/**
	 * Get a single card by ID with ownership verification
	 * Includes all schedules and forward schedule SM-2 data for backwards compatibility
	 */
	async getCardById(cardId: number, userId: number): Promise<FormattedCardWithSchedule> {
		const card = await prisma.card.findFirst({
			where: {
				id: cardId,
				deck: {
					topic: {
						userId
					}
				}
			},
			include: {
				deck: {
					select: {
						id: true,
						name: true,
						topicId: true,
						isBidirectional: true,
						topic: {
							select: {
								id: true,
								name: true
							}
						}
					}
				},
				schedules: {
					orderBy: {
						isReversed: 'asc' // Forward schedule first
					}
				}
			}
		});

		if (!card) {
			throw new Error('Card not found or does not belong to the user');
		}

		// Get forward schedule (isReversed = false)
		const forwardSchedule = card.schedules.find((s) => !s.isReversed);

		// Format all schedules
		const schedules: ScheduleData[] = card.schedules.map((s) => ({
			id: s.id,
			isReversed: s.isReversed,
			lastSeen: s.lastSeen,
			grade: s.grade as Grade | null,
			repCount: s.repCount,
			easiness: s.easiness,
			interval: s.interval,
			version: s.version
		}));

		return {
			id: card.id,
			front: card.front,
			back: card.back,
			note: card.note,
			priority: card.priority as Priority,
			tags: card.tags,
			deckId: card.deckId,
			deckName: card.deck.name,
			topicId: card.deck.topicId,
			topicName: card.deck.topic.name,
			createdAt: card.createdAt,
			updatedAt: card.updatedAt,
			version: card.version,
			isBidirectional: card.deck.isBidirectional,
			schedules: schedules,
			// SM-2 data from forward schedule (for backwards compatibility)
			lastSeen: forwardSchedule?.lastSeen ?? null,
			grade: (forwardSchedule?.grade as Grade | null) ?? null,
			repCount: forwardSchedule?.repCount ?? 0,
			easiness: forwardSchedule?.easiness ?? 2.5,
			interval: forwardSchedule?.interval ?? 1,
			scheduleId: forwardSchedule?.id ?? null,
			scheduleVersion: forwardSchedule?.version ?? 0
		};
	}

	/**
	 * Update an existing card (content only, not SM-2 scheduling data)
	 * Uses transaction to atomically check authorization and update card
	 * Supports optimistic locking via version field
	 * Note: SM-2 scheduling updates should use schedule-service
	 */
	async updateCard(
		cardId: number,
		userId: number,
		updateData: UpdateCardParams
	): Promise<FormattedCard> {
		try {
			// Use transaction to atomically check authorization and update card
			const updatedCard = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
				// Verify ownership (authorization check)
				const existingCard = await tx.card.findFirst({
					where: {
						id: cardId,
						deck: {
							topic: {
								userId
							}
						}
					},
					include: {
						deck: {
							select: {
								topicId: true
							}
						}
					}
				});

				if (!existingCard) {
					throw new Error('Card not found or does not belong to the user');
				}

				// If deckId is provided, ensure it belongs to the user
				if (updateData.deckId) {
					const newDeck = await tx.deck.findFirst({
						where: {
							id: updateData.deckId,
							topic: {
								userId
							}
						}
					});

					if (!newDeck) {
						throw new Error('New deck not found or does not belong to the user');
					}
				}

				// Prepare data for update (content fields only)
				const data: Prisma.CardUpdateInput = {
					front: updateData.front,
					back: updateData.back,
					note: updateData.note,
					priority: updateData.priority,
					tags: updateData.tags
				};

				// Update deck relation if deckId is provided
				if (updateData.deckId) {
					data.deck = {
						connect: { id: updateData.deckId }
					};
				}

				// Optimistic locking: Build where clause with version check if provided
				const whereClause: Prisma.CardWhereUniqueInput = { id: cardId };
				if (updateData.version !== undefined) {
					whereClause.version = updateData.version;
					// Increment version on update to prevent concurrent modifications
					data.version = { increment: 1 };
				}

				// Update the card with optimistic locking
				return await tx.card.update({
					where: whereClause,
					data,
					include: {
						deck: {
							select: {
								id: true,
								name: true,
								topicId: true,
								topic: {
									select: {
										id: true,
										name: true
									}
								}
							}
						}
					}
				});
			});

			// Format the updated card to FormattedCard
			return {
				id: updatedCard.id,
				front: updatedCard.front,
				back: updatedCard.back,
				note: updatedCard.note,
				priority: updatedCard.priority as Priority,
				tags: updatedCard.tags,
				deckId: updatedCard.deckId,
				deckName: updatedCard.deck.name,
				topicId: updatedCard.deck.topicId,
				topicName: updatedCard.deck.topic.name,
				createdAt: updatedCard.createdAt,
				updatedAt: updatedCard.updatedAt,
				version: updatedCard.version
			};
		} catch (error: unknown) {
			// Handle version conflict (optimistic locking failure)
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
				const versionError: Error & { code?: string } = new Error(
					'This card was modified by another request. Please refresh and try again.'
				);
				versionError.code = 'VERSION_CONFLICT';
				throw versionError;
			}
			throw error;
		}
	}

	/**
	 * Delete a card
	 */
	async deleteCard(cardId: number, userId: number): Promise<void> {
		// Verify ownership first
		const existingCard = await prisma.card.findFirst({
			where: {
				id: cardId,
				deck: {
					topic: {
						userId
					}
				}
			}
		});

		if (!existingCard) {
			throw new Error('Card not found or does not belong to the user');
		}

		await prisma.card.delete({
			where: { id: cardId }
		});
	}
}

// Export a singleton instance
export const cardService = new CardService();
