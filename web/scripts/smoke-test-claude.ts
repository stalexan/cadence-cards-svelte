/**
 * End-to-end smoke test for the Claude integration.
 *
 * Makes a single real Anthropic API call using the exact request shape the app
 * uses in src/lib/server/claude/client.ts — model + max_tokens from env,
 * adaptive thinking, output_config.effort, and NO temperature (which 400s on
 * Opus 4.8). Verifies the configured model/key/params actually return a 200
 * with text. Costs one (small) API call.
 *
 * Usage:
 *   docker compose exec -it web npx tsx scripts/smoke-test-claude.ts
 */

import { Anthropic } from '@anthropic-ai/sdk';

const apiKey = process.env.CLAUDE_API_KEY ?? '';
const model = process.env.CLAUDE_MODEL || 'claude-opus-4-8';
const maxTokens = process.env.CLAUDE_MAX_TOKENS
	? parseInt(process.env.CLAUDE_MAX_TOKENS, 10)
	: 4000;
const effort = 'high' as const;

async function main() {
	if (!apiKey || apiKey.startsWith('change_me')) {
		console.error('✗ CLAUDE_API_KEY is not set to a real key in the container environment.');
		process.exit(1);
	}

	console.log(`Calling ${model} (max_tokens=${maxTokens}, effort=${effort}, adaptive thinking)...`);

	const anthropic = new Anthropic({ apiKey });
	const start = Date.now();

	const response = await anthropic.messages.create({
		model,
		max_tokens: maxTokens,
		thinking: { type: 'adaptive' },
		output_config: { effort },
		messages: [
			{
				role: 'user',
				content: 'Reply with exactly the word: pong'
			}
		]
	});

	const duration = Date.now() - start;
	const text = response.content.find((b) => b.type === 'text');

	console.log('—'.repeat(40));
	console.log('model returned :', response.model);
	console.log('stop_reason    :', response.stop_reason);
	console.log('usage          :', JSON.stringify(response.usage));
	console.log('block types    :', response.content.map((b) => b.type).join(', '));
	console.log(
		'text           :',
		text && text.type === 'text' ? JSON.stringify(text.text) : '(none)'
	);
	console.log('duration       :', `${duration}ms`);
	console.log('—'.repeat(40));

	if (response.stop_reason === 'refusal') {
		console.error('✗ Request was refused by safety classifiers.');
		process.exit(1);
	}
	if (!text || text.type !== 'text' || text.text.trim().length === 0) {
		console.error('✗ No non-empty text block in the response.');
		process.exit(1);
	}

	console.log('✓ Smoke test passed: real 200 response with text from', response.model);
}

main().catch((err) => {
	console.error('✗ Smoke test failed:', err?.status ?? '', err?.message ?? err);
	process.exit(1);
});
