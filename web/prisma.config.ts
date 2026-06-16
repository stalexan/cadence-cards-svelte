import { defineConfig, env } from 'prisma/config';

// Prisma 7 configuration. Replaces the legacy `prisma` key in package.json and
// the `url` field in the schema's datasource block. DATABASE_URL is supplied by
// the container environment (docker compose), so no .env loading is needed here.
export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
		seed: 'tsx prisma/seed.ts'
	},
	datasource: {
		url: env('DATABASE_URL')
	}
});
