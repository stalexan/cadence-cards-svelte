# Dependency Management

How this project keeps its npm dependencies current, and which upgrades are
**deliberately held back** (and why).

## Routine Updates

Dependency and image checks are wrapped by `scripts/check-updates.sh`, which
runs `npm-check-updates` inside the `web` container and scans the built images
for CVEs with Docker Scout. It makes no changes.

Safe minor/patch bumps are applied from inside the container:

```bash
docker compose exec web npx npm-check-updates --target minor -u
docker compose exec web npm install
```

`--target minor` intentionally excludes major-version bumps. After bumping,
always verify (inside the container):

```bash
npm run check   # svelte-check typecheck
npm run lint    # prettier --check && eslint
npm run test    # vitest
```

Because the toolchain is baked into the image (`node_modules` is masked by a
volume at runtime), a dependency change only takes effect in the running dev
stack after a rebuild:

```bash
docker compose build web && docker compose up -d
```

## Held-Back Major Upgrades

`npm-check-updates` will keep surfacing the majors below as "available." They
are held **on purpose** — do not apply them as part of routine updates. Each
entry lists the condition under which it becomes safe to revisit.

### `typescript` 6 → 7 — HOLD

TypeScript 7 is the ground-up **native (Go) compiler rewrite**, and its
JavaScript compiler API changed incompatibly. The type-checking tooling this
project relies on crashes against it:

- `npm run check` (svelte-check) fails.
- `npm run lint` (typescript-eslint / `typescript-estree`) crashes with
  `TypeError: Cannot read properties of undefined (reading 'Cjs')`.

`npm run build` (Vite/esbuild) and `npm run test` (Vitest) still pass under
TS 7 — but only because they *strip* types instead of type-checking, so a green
build here would hide the fact that typecheck and lint are broken.

**Revisit when** `svelte-check` (svelte-language-tools) and `typescript-eslint`
ship releases that declare support for TypeScript 7. typescript-eslint gates on
a supported-TypeScript range; watch its release notes.

### `@types/node` 24 → 26 — HOLD

`@types/node` must track the Node **runtime** major, and both Dockerfiles run
`node:24-trixie-slim`. Bumping the types to 26 ahead of the runtime pulls in
type definitions for Node 26 APIs that do not exist under Node 24 — code would
typecheck clean but could throw at runtime.

**Revisit when** the base image is moved to Node 26 (a separate, deliberate
change). Bump `@types/node` in lockstep with the runtime, not ahead of it.

## History

- **2026-07**: Applied minor/patch bumps; verified `typescript` 6→7 breaks
  svelte-check and typescript-eslint, and confirmed `@types/node` should stay
  pinned to the Node 24 runtime. Both majors held.
