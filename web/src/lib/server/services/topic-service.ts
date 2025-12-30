import { prisma } from '$lib/server/db';
import { Prisma } from '@prisma/client';

/**
 * Parameters for creating a new topic
 */
export interface CreateTopicParams {
	userId: number;
	name: string;
	topicDescription?: string;
	expertise?: string;
	focus?: string;
	contextType?: string;
	example?: string;
	question?: string;
}

/**
 * Parameters for updating a topic
 */
export interface UpdateTopicParams {
	name?: string;
	topicDescription?: string;
	expertise?: string;
	focus?: string;
	contextType?: string;
	example?: string;
	question?: string;
}

/**
 * Topic with counts for decks and cards
 */
export interface TopicWithCounts {
	id: number;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	deckCount: number;
	cardCount: number;
}

/**
 * Service class for topic-related business logic
 */
export class TopicService {
	/**
	 * Get all topics for a user with deck and card counts
	 */
	async getTopics(userId: number): Promise<TopicWithCounts[]> {
		// Fetch topics with deck and card counts using raw query
		const topics = (await prisma.$queryRaw`
      SELECT
        t.id,
        t.name,
        t."createdAt" as "createdAt",
        t."updatedAt" as "updatedAt",
        COUNT(DISTINCT d.id) as "deckCount",
        COUNT(DISTINCT c.id) as "cardCount"
      FROM
        "Topic" t
      LEFT JOIN
        "Deck" d ON t.id = d."topicId"
      LEFT JOIN
        "Card" c ON d.id = c."deckId"
      WHERE
        t."userId" = ${userId}
      GROUP BY
        t.id
      ORDER BY
        t."createdAt" DESC
    `) as Array<{
			id: number;
			name: string;
			createdAt: Date;
			updatedAt: Date;
			deckCount: bigint;
			cardCount: bigint;
		}>;

		// Convert BigInt values to numbers for JSON compatibility
		return topics.map((topic) => ({
			...topic,
			deckCount: Number(topic.deckCount),
			cardCount: Number(topic.cardCount)
		}));
	}

	/**
	 * Get a single topic by ID with ownership verification
	 */
	async getTopicById(topicId: number, userId: number) {
		const topic = await prisma.topic.findFirst({
			where: {
				id: topicId,
				userId
			}
		});

		if (!topic) {
			throw new Error('Topic not found');
		}

		return topic;
	}

	/**
	 * Create a new topic
	 * Relies on database unique constraint @@unique([name, userId]) for duplicate detection
	 */
	async createTopic(params: CreateTopicParams) {
		const { userId, name, topicDescription, expertise, focus, contextType, example, question } =
			params;

		try {
			// Create the new topic - database will enforce name uniqueness atomically
			const topic = await prisma.topic.create({
				data: {
					name,
					topicDescription,
					expertise,
					focus,
					contextType,
					example,
					question,
					userId
				}
			});

			return topic;
		} catch (error) {
			// Handle unique constraint violation
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002' &&
				error.meta?.target &&
				Array.isArray(error.meta.target) &&
				error.meta.target.includes('name')
			) {
				throw new Error('A topic with this name already exists');
			}
			throw error;
		}
	}

	/**
	 * Update an existing topic
	 * Uses transaction to atomically check authorization and update topic
	 * Relies on database unique constraint @@unique([name, userId]) for duplicate detection
	 */
	async updateTopic(topicId: number, userId: number, updateData: UpdateTopicParams) {
		try {
			// Use transaction to atomically check authorization and update topic
			const updatedTopic = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
				// Check if topic exists and belongs to the user (authorization check)
				const existingTopic = await tx.topic.findFirst({
					where: {
						id: topicId,
						userId
					}
				});

				if (!existingTopic) {
					throw new Error('Topic not found');
				}

				// Update the topic - database will enforce name uniqueness atomically
				return await tx.topic.update({
					where: { id: topicId },
					data: updateData
				});
			});

			return updatedTopic;
		} catch (error: unknown) {
			// Handle unique constraint violation
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002' &&
				error.meta?.target &&
				Array.isArray(error.meta.target) &&
				error.meta.target.includes('name')
			) {
				throw new Error('A topic with this name already exists');
			}
			throw error;
		}
	}

	/**
	 * Delete a topic
	 */
	async deleteTopic(topicId: number, userId: number): Promise<void> {
		// Check if topic exists and belongs to the user
		const existingTopic = await prisma.topic.findFirst({
			where: {
				id: topicId,
				userId
			}
		});

		if (!existingTopic) {
			throw new Error('Topic not found');
		}

		// Delete the topic (cascading deletion will remove associated decks and cards)
		await prisma.topic.delete({
			where: { id: topicId }
		});
	}
}

// Export a singleton instance
export const topicService = new TopicService();
