// Claude types

export interface TopicConfig {
	TOPIC: string;
	TOPIC_DESC: string;
	EXPERTISE: string;
	FOCUS: string;
	CONTEXT_TYPE: string;
	EXAMPLE: string;
	QUESTION: string;
}

export interface GeneratedPrompts {
	IDENTITY: string;
	STATIC_CONTEXT: string;
	EXAMPLES: string;
	ADDITIONAL_GUARDRAILS: string;
	GENERAL_INSTRUCTIONS: string;
	PRACTICE_INSTRUCTIONS: string;
}

// Re-export ChatMessage from shared types for convenience
export type { ChatMessage } from '$lib/types/api';
