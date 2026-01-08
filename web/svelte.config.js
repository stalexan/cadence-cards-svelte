import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Content Security Policy (CSP) Configuration
 *
 * CSP provides defense-in-depth against XSS attacks by restricting where
 * resources can be loaded from. SvelteKit handles nonce generation automatically
 * for inline scripts.
 *
 * Set to false to disable CSP (useful for debugging or if it causes issues).
 * In production, this should be true.
 */
const ENABLE_CSP = true;

/**
 * CSP Directives
 *
 * - default-src 'self': Only allow resources from same origin by default
 * - script-src 'self': Scripts only from same origin (SvelteKit adds nonces for inline)
 * - style-src 'self' 'unsafe-inline': Styles from same origin + inline (needed for Tailwind)
 * - img-src 'self' data: blob:: Images from same origin + data URIs + blob URLs
 * - font-src 'self': Fonts only from same origin
 * - connect-src 'self': XHR/fetch/WebSocket only to same origin (Claude API is server-side)
 * - frame-ancestors 'none': Prevent embedding in iframes (replaces X-Frame-Options)
 * - form-action 'self': Forms can only submit to same origin
 * - base-uri 'self': Restrict <base> tag to same origin
 * - object-src 'none': Block <object>, <embed>, <applet> tags
 */
const cspConfig = ENABLE_CSP
	? {
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'frame-ancestors': ['none'],
				'form-action': ['self'],
				'base-uri': ['self'],
				'object-src': ['none']
			}
		}
	: undefined;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			out: 'build'
		}),
		alias: {
			$lib: 'src/lib'
		},
		csp: cspConfig
	}
};

export default config;
