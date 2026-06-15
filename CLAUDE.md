# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Docker-First Development

All Node/npm/npx/prisma commands run **inside the `web` container**, never on the host. The host has
no Node toolchain by design (see `.cursorrules`). `manage.py` is a symlink to `scripts/manage.py`,
which loads the `scripts/manage` **git submodule** — run `git submodule update --init` if
`scripts/manage/` is empty.

```bash
# Bring up the stack (ENVIRONMENT defaults to dev)
./manage.py build
./manage.py up -d

# Open a shell in the web container to run npm/npx/prisma
./manage.py shell --service web

# One-off command without a shell
docker compose exec web npm run lint
```

`ENVIRONMENT=dev` (default) uses `web/Dockerfile.dev` + Vite dev server on **:5173** with source
mounted and hot reload. `ENVIRONMENT=prod` uses `web/Dockerfile.prod` (multi-stage, `npm run build`
→ `node build`) on **:3000** behind nginx. Both compose files layer over `docker-compose.yml`.

The base compose file attaches `web` to an **external** Docker network `elias2-shared-network` (so
an external nginx can reach it). Create it first or `up` fails: `docker network create
elias2-shared-network`.

## Common Commands (run inside the web container)

```bash
npm run dev          # Vite dev server (:5173)
npm run build        # Production build
npm run lint         # prettier --check . && eslint .
npm run format       # prettier --write .
npm run check        # svelte-kit sync && svelte-check (typecheck)

npx prisma migrate dev          # Create/apply a migration against the dev DB
npx prisma db seed              # Seed sample data (tsx prisma/seed.ts)
npx prisma generate             # Regenerate the Prisma client after schema edits
```

There is **no test runner** — Vitest was removed (see commit history). Don't assume `npm test`
exists. Verify changes with `npm run check` and `npm run lint`.

`./manage.py check-updates` scans for outdated npm packages, stale base images, and CVEs (Docker
Scout). Apply safe npm bumps from inside the container with `npx npm-check-updates --target minor -u
&& npm install`.

## Architecture

SvelteKit is the unified frontend + backend. All application code lives under `web/`. Layered request flow:

**Route handler → Service class → Prisma.** API routes in `web/src/routes/api/**/+server.ts` stay
thin: they call `requireAuth(event)`, parse the body with a **Zod** schema, delegate to a service,
and wrap everything in `try/catch` returning `handleApiError(err, { operation })`. See
`web/src/lib/server/api-helpers.ts` for `requireAuth`, `jsonResponse`, and `handleApiError` (which
maps Zod and Prisma error codes — P2025→404, P2002→409, P2003→400 — to responses). Follow this
pattern for every new endpoint.

**Services** (`web/src/lib/server/services/`, one class per domain: deck, card, topic, study,
schedule, dashboard, import; exported as singletons via `index.ts`) hold all business logic and own
Prisma access. **Authorization belongs in the service inside a `prisma.$transaction`** — ownership
checks and writes must be atomic so a user can't act on another user's records (see
`docs/ATOMICITY.md`). Routes never check ownership themselves beyond `requireAuth`.

**Database** (`web/prisma/schema.prisma`): `User → Topic → Deck → Card → Schedule`, all
cascade-deleting downward. A `Card` has one `Schedule` per direction (`isReversed` false=front→back,
true=back→front; `@@unique([cardId, isReversed])`) to support bidirectional decks. SM-2 fields
(`easiness`, `interval`, `repCount`, `grade`, `lastSeen`) live on `Schedule`, not `Card`. `prisma`
client is a hot-reload-safe global singleton in `web/src/lib/server/db.ts`.

**Optimistic locking**: `Card` and `Schedule` carry a `version Int`, incremented on each update.
Concurrent edits must compare-and-increment `version` to reject lost updates — preserve this when
writing update logic.

**SM-2 algorithm** lives in `web/src/lib/sm2.ts` (pure, framework-free). Grades are the `CardGrade`
enum (`INCORRECT`, `CORRECT_WITH_HESITATION`, `CORRECT_PERFECT_RECALL`).

**Claude integration** (`web/src/lib/server/claude/`) is strictly layered: `client.ts` (singleton
Anthropic SDK client + `generateMessage`/`generateText` + a `tokenTracker`) ← `prompts/` (prompt
templates, no API calls) ← `services/` (`card-creation`, `study-assistance` — compose prompts and
call the client). All Claude calls are server-side only; CSP `connect-src 'self'` blocks any
client-side LLM calls. Model and limits come from `CLAUDE_MODEL` / `CLAUDE_MAX_TOKENS` env. Deep
reference: `docs/CLAUDE_PROMPTING.md`.

**Request lifecycle** (`web/src/hooks.server.ts`) chains, in order: rate limiting → Auth.js
(`authHandle`) → security headers. IP is taken from the nginx-set `x-real-ip` only (other client-IP
headers are treated as spoofable). CSP is defined in `web/svelte.config.js` (not in hooks), using
SvelteKit's nonce-based CSP support.

**Auth** (`web/src/auth.ts`): Auth.js (`@auth/sveltekit`) with a Credentials provider, **JWT
sessions** (30-day), bcrypt password verification (`web/src/lib/server/password.ts`). Public
registration is gated by `ENABLE_PUBLIC_REGISTRATION`. The login flow integrates with the rate
limiter for per-IP and per-email lockouts.

**Rate limiting** (`web/src/lib/server/rate-limiter.ts`): in-memory, progressive lockouts. Set
`DISABLE_RATE_LIMITING=true` to bypass in dev. (Note: `docs/RATE_LIMITING.md` describes an older
NextAuth/`proxy.ts` setup and lists extra trusted IP headers — the current code in
`hooks.server.ts`/`auth.ts` is authoritative and only trusts `x-real-ip`.)

**Routing groups**: `web/src/routes/(dashboard)/` are the authenticated app pages; `login/` and
`register/` are public. `$lib` aliases `web/src/lib`.

## Conventions

- Validate all request input with Zod schemas defined in the `+server.ts` file.
- Use the structured `logger` (`web/src/lib/server/logger.ts`) with an `operation` field and request
  tracing (`x-request-id`); it exposes `logger.audit` and `logger.security` for auth events. See
  `docs/LOGGING.md`. Never `console.log` in server code.
- Import/export uses YAML (`web/src/lib/yaml-utils.ts`); the import path tolerates YAML with or
  without the metadata header comments.
- Versioning: bump the root `VERSION` file in its own commit and tag `v<version>` (see
  `docs/VERSIONING.md`). Commit message conventions are in `docs/COMMIT_MESSAGES.md`.
