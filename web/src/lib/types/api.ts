/**
 * API Type Definitions
 *
 * This file contains API request/response types that define the contract between
 * client and server. These types follow the DTO (Data Transfer Object) pattern
 * and are intentionally decoupled from internal database models.
 *
 * DEPENDENCIES:
 *   - primitives.ts (Priority, Grade enums)
 *   - domain.ts (DashboardStats, StudyStats - for response types)
 *
 * IMPORTED BY:
 *   - API route handlers (for request validation)
 *   - Client-side API hooks and services
 *   - Svelte components (for type-safe API calls)
 *
 * RULES:
 *   - API types represent what flows over the wire (often a subset of fields)
 *   - Database types represent internal models (with relations, metadata)
 *   - This separation allows API contracts to evolve independently from data models
 *   - Request types contain only fields clients can modify
 *   - Response types may flatten or transform database structures for client consumption
 */

import type { Priority, Grade } from './primitives';
import type { DashboardStats, StudyStats } from './domain';

// Auth API
export interface RegisterRequest {
	name: string;
	email: string;
	password: string;
}

export interface LoginRequest {
	email: string;
	password: string;
}

// User API
export interface UpdateProfileRequest {
	name: string;
	email: string;
}

export interface ChangePasswordRequest {
	currentPassword: string;
	newPassword: string;
}

// Topic API
export interface CreateTopicRequest {
	name: string;
	systemPrompt?: string;
	studyPrompt?: string;
}

export interface UpdateTopicRequest {
	name: string;
	systemPrompt?: string;
	studyPrompt?: string;
}

// Deck API
export interface CreateDeckRequest {
	name: string;
	topicId: number;
}

export interface UpdateDeckRequest {
	name: string;
	topicId?: number;
}

// Card API
export interface CreateCardRequest {
	front: string;
	back: string;
	note?: string | null;
	priority: Priority;
	tags?: string[];
	deckId: number;
}

export interface UpdateCardRequest {
	front?: string;
	back?: string;
	note?: string | null;
	priority?: Priority;
	tags?: string[];
	deckId?: number;
	grade?: Grade | null;
	lastSeen?: string | null;
	repCount?: number;
	easiness?: number;
	interval?: number;
}

export interface CardFilterParams {
	deckId?: number;
	topicId?: number;
	priority?: Priority;
	isDue?: boolean;
	tag?: string;
	search?: string;
}

// Claude-Assisted Card Creation API
export interface CardGenerationRequest {
	instruction: string; // User's instruction for card creation
	topicId: number; // Topic context
	topicName: string; // Topic name for context
	deckId: number; // Destination deck
	existingTags?: string[]; // Optional existing tags for context
	includeSuggestions?: boolean; // Whether to include tag/priority suggestions
}

export interface CardGenerationResponse {
	front: string;
	back: string;
	note: string | null;
	suggestedPriority: Priority;
	suggestedTags: string[];
	explanation: string; // Explanation of the generated content
}

export interface CardRefinementRequest {
	feedback: string; // User's feedback/request for changes
	currentCardData: {
		// Current state of the card
		front: string;
		back: string;
		note: string | null;
		priority: Priority;
		tags: string[];
	};
	topicId: number;
	topicName: string;
	deckId: number;
	previousExchanges: CardRefinementExchange[]; // Conversation history
}

export interface CardRefinementExchange {
	instruction: string; // User instruction/feedback
	response: {
		// Claude's response
		front: string;
		back: string;
		note: string | null;
		suggestedPriority: Priority;
		suggestedTags: string[];
		explanation: string;
	};
	timestamp: string;
}

export interface CardRefinementResponse {
	front: string;
	back: string;
	note: string | null;
	suggestedPriority: Priority;
	suggestedTags: string[];
	explanation: string;
	isSignificantChange: boolean; // Whether the change is substantial
}

// Study API
export interface StudyCardsParams {
	topicId: string;
	deckIds: string[];
}

/**
 * API response type for study statistics
 * Directly matches the StudyStats interface
 */
export type StudyStatsResponse = StudyStats;

export interface GenerateQuestionRequest {
	cardFront: string;
	cardBack: string;
	cardNote?: string | null;
	topicName: string;
	topicId: string;
}

export interface GenerateQuestionResponse {
	question: string;
}

export interface EvaluateAnswerRequest {
	userAnswer: string;
	cardFront: string;
	cardBack: string;
	cardNote?: string | null;
	previousMessages: ChatMessage[];
	isGraded: boolean;
	topicName: string;
	topicId: string;
}

export interface EvaluateAnswerResponse {
	response: string;
}

// Chat API
export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface ChatRequest {
	message: string;
	topicId: string;
	topicName: string;
	previousMessages: ChatMessage[];
}

export interface ChatResponse {
	response: string;
}

// Import API
export interface ImportRequest {
	yamlContent: string;
	deckId: number;
}

export interface ImportResponse {
	success: boolean;
	importedCount: number;
	failedCount: number;
	errors: string[];
	message?: string;
}

// Dashboard API
/**
 * Dashboard statistics response - aliased to the domain type
 * since API response matches the domain model exactly
 */
export type DashboardStatsResponse = DashboardStats;
