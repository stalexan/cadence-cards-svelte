import { Anthropic } from '@anthropic-ai/sdk';
import { logger } from '../logger';
import { env } from '$env/dynamic/private';

// Initialize client (singleton pattern)
const anthropic = new Anthropic({
	apiKey: env.CLAUDE_API_KEY || ''
});

// Token tracker
class TokenTracker {
	private messageInput: number = 0;
	private messageOutput: number = 0;
	private totalInput: number = 0;
	private totalOutput: number = 0;
	private updateLock: Promise<void> = Promise.resolve();

	async updateStats(response: Anthropic.Message) {
		this.updateLock = this.updateLock.then(() => {
			this.messageInput = response.usage.input_tokens;
			this.messageOutput = response.usage.output_tokens;
			this.totalInput += this.messageInput;
			this.totalOutput += this.messageOutput;
		});
		await this.updateLock;
	}

	getStats() {
		return {
			message: { input: this.messageInput, output: this.messageOutput },
			total: { input: this.totalInput, output: this.totalOutput }
		};
	}
}

export const tokenTracker = new TokenTracker();

// Message options interface
export interface ClaudeMessageOptions {
	model?: string;
	system?: string;
	messages: Array<{ role: 'user' | 'assistant'; content: string }>;
	max_tokens?: number;
	temperature?: number;
}

// Core API call function
export async function generateMessage(options: ClaudeMessageOptions): Promise<Anthropic.Message> {
	const {
		model = env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
		system = '',
		messages,
		max_tokens,
		temperature = 0.7
	} = options;

	// Use environment variable for max_tokens if not provided
	const maxTokensToUse =
		typeof max_tokens === 'number'
			? max_tokens
			: env.CLAUDE_MAX_TOKENS
				? parseInt(env.CLAUDE_MAX_TOKENS, 10)
				: 1000;

	const startTime = Date.now();

	logger.debug('Claude API request initiated', {
		model,
		systemPromptLength: system.length,
		messageCount: messages.length,
		messages: messages.map((m, i) => ({
			index: i,
			role: m.role,
			contentLength: m.content.length
		})),
		maxTokens: maxTokensToUse,
		temperature,
		operation: 'claude_api_request'
	});

	try {
		const response = await anthropic.messages.create({
			model,
			system,
			max_tokens: maxTokensToUse,
			temperature,
			messages
		});

		const duration = Date.now() - startTime;

		await tokenTracker.updateStats(response);

		logger.info('Claude API request completed', {
			model,
			duration,
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens,
			totalTokens: response.usage.input_tokens + response.usage.output_tokens,
			stopReason: response.stop_reason,
			stopSequence: response.stop_sequence || 'none',
			contentType: response.content?.[0]?.type || 'unknown',
			operation: 'claude_api_request'
		});

		return response;
	} catch (error) {
		const duration = Date.now() - startTime;

		logger.error('Claude API request failed', error, {
			model,
			duration,
			maxTokens: maxTokensToUse,
			messageCount: messages.length,
			temperature,
			operation: 'claude_api_request'
		});

		throw error;
	}
}

// Helper to extract text from response
export function extractTextFromResponse(response: Anthropic.Message): string {
	for (const block of response.content) {
		if (block.type === 'text') {
			return block.text;
		}
	}
	return '';
}

// Helper to extract text and return directly
export async function generateText(options: ClaudeMessageOptions): Promise<string> {
	const response = await generateMessage(options);
	return extractTextFromResponse(response);
}
