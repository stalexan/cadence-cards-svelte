import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		// Node-only unit tests for pure logic (no browser/Playwright project).
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		exclude: ['src/**/*.svelte.{test,spec}.ts']
	}
});
