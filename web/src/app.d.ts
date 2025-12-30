// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session } from '@auth/sveltekit';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth(): Promise<Session | null>;
		}
		interface PageData {
			session?: Session | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

// Extend the Session and User types
declare module '@auth/sveltekit' {
	interface Session {
		user: {
			id: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	}
}

declare module '@auth/core/types' {
	interface User {
		id: string;
		name?: string | null;
		email?: string | null;
	}
}

export {};
