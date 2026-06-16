# Testing

## Overview

Unit tests run with [Vitest](https://vitest.dev/), configured **node-only** — there is no browser or
component-testing project. This is deliberate: an earlier Vitest setup was removed (commit `48dee61`)
because the browser stack (`@vitest/browser-playwright`, `vitest-browser-svelte`, `playwright`)
pinned exact peer dependencies that caused an `ERESOLVE` conflict during a dependency bump. The
current setup keeps only the node runner, which avoids that conflict and stays minimal.

Tests are **co-located** with the code they cover, as `*.test.ts` files next to the source. Current
coverage is the project's pure logic:

- `web/src/lib/sm2.ts` — the SM-2 spaced-repetition algorithm
- `web/src/lib/yaml-utils.ts` — YAML import/export
- `web/src/lib/utils.ts` — formatting, pagination, and other helpers

## Running the tests

Like all Node tooling in this project, tests run **inside the `web` container** — the host has no
Node toolchain by design (see [CLAUDE.md](../CLAUDE.md) and the Docker-first notes in the README).

```bash
docker compose exec web npm run test           # vitest run (one-shot, CI-style)
docker compose exec web npm run test:watch     # watch mode, reruns on change
docker compose exec web npm run test:coverage  # one-shot run with V8 coverage report
```

Run a single file by passing it through to Vitest after `--`:

```bash
docker compose exec web npm run test -- src/lib/sm2.test.ts
```

Tests are one of the project's verification gates, alongside type-checking and linting. After a
change, run all three:

```bash
docker compose exec web npm run test
docker compose exec web npm run check   # svelte-kit sync && svelte-check (typecheck)
docker compose exec web npm run lint    # prettier --check . && eslint .
```

## How tests are configured

The Vitest configuration lives in the `test` block of `web/vite.config.ts`:

```ts
test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['src/**/*.svelte.{test,spec}.ts']
}
```

- `environment: 'node'` — no jsdom/browser; tests exercise plain TypeScript.
- The `include` glob picks up any `*.test.ts` / `*.spec.ts` under `src/`.
- The `exclude` glob reserves `*.svelte.test.ts` for any future browser-style tests so this node
  config never accidentally pulls them in.
- The `sveltekit()` plugin is active, so the `$lib` alias resolves in tests exactly as it does in
  app code — import modules the same way you would from a route or service.

The npm scripts (`test`, `test:watch`, `test:coverage`) are defined in `web/package.json`.

## Adding a new test

**Where:** put the test next to the code it covers. For `web/src/lib/foo.ts`, add
`web/src/lib/foo.test.ts`.

**Imports:** import the test helpers explicitly from `vitest`. Globals are intentionally **not**
enabled — explicit imports keep ESLint happy with no extra configuration.

```ts
import { describe, it, expect } from 'vitest';
import { myFunction } from './foo';

describe('myFunction', () => {
    it('does the expected thing', () => {
        expect(myFunction(input)).toBe(expected);
    });
});
```

**What to test:** prefer **pure logic** — code with no database, network, or framework dependencies.
The best targets live under `web/src/lib/` (algorithms, formatters, validation/parsing). Modules
under `web/src/lib/server/services/` own Prisma access and are **not** suited to these unit tests;
they need a database and belong to a different testing layer.

**Patterns worth borrowing** from the existing suites:

- **Day-based / scheduling logic:** construct dates relative to `new Date()` rather than hard-coding
  wall-clock values, and assert on fields that don't depend on the current time. See the
  `daysAgo()` helper and the due-date cases in `web/src/lib/sm2.test.ts`.
- **Validation and roundtrips:** test both the happy path and the failure path. See
  `web/src/lib/yaml-utils.test.ts`, which checks a valid export/import roundtrip *and* that malformed
  or invalid input is rejected and reported.
- **Edge cases over volume:** boundaries (empty input, exactly-at-limit, off-by-one) tend to catch
  the real bugs — see the pagination cases in `web/src/lib/utils.test.ts`.

**Before committing**, make sure all three gates pass:

```bash
docker compose exec web npm run test
docker compose exec web npm run check
docker compose exec web npm run lint
```

Use the `test:` Conventional Commit prefix for test-only changes (see
[COMMIT_MESSAGES.md](COMMIT_MESSAGES.md)).

## Scope

This harness covers **node-only unit tests of pure logic**. Intentionally out of scope:

- **Browser / Svelte component tests** and **end-to-end tests** — omitted to keep the toolchain
  minimal and to avoid the dependency conflict that removed the original setup.
- **Services and route handlers that need a database** — these require a test database or Prisma
  mocking and are not covered by these unit tests.
