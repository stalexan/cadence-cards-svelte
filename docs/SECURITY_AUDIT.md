# Security Audit

Known npm audit findings and their status. Last reviewed: 2026-06-16.

## Summary

`npm audit` reports **8 vulnerabilities** (4 low, 4 high). None require immediate
action: the high-severity items have no real exposure for this app's
Linux/Docker deployment, and every remaining finding clears itself when the
corresponding major dependency upgrade (Vite 7→8, SvelteKit 2→3) is taken
deliberately. `npm audit fix --force` is **not** safe here — it would downgrade
`@sveltejs/kit` to `0.0.30` and pull in an unvetted `vite@8` major.

| Finding | Severity | Real exposure | Cleared by |
| --- | --- | --- | --- |
| `esbuild` 0.17–0.28 | High ×4 | None (Deno-only / Windows-dev-server-only; dev-time dep) | Vite 7→8 + vite-plugin-svelte 6→7 |
| `cookie` <0.7.0 | Low ×4 | Low (SvelteKit owns cookie serialization) | A future SvelteKit 2.x patch, or SvelteKit 3.0 |

## Resolved

### js-yaml <=4.1.1 (Moderate) — fixed 2026-06-16

- **Advisory**: [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68)
- **Severity**: Moderate
- **Affected path**: `eslint` → `@eslint/eslintrc` → `js-yaml` (dev-only, transitive)

Quadratic-complexity DoS in merge-key handling via repeated aliases. Bumped
`js-yaml` 4.1.1 → 4.2.0 via `npm audit fix` (semver-compatible, no `--force`).
Only `web/package-lock.json` changed; `npm run check` and `npm run test` pass.

## esbuild 0.17.0–0.28.0 (High)

- **Advisories**:
  [GHSA-gv7w-rqvm-qjhr](https://github.com/advisories/GHSA-gv7w-rqvm-qjhr)
  (missing binary integrity verification in the **Deno** module enables RCE via
  `NPM_CONFIG_REGISTRY`),
  [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)
  (arbitrary file read when running the **dev server on Windows**)
- **Severity**: High
- **Affected packages**: `vite`, `@sveltejs/vite-plugin-svelte`,
  `@sveltejs/vite-plugin-svelte-inspector`

**Why this is acceptable**: `esbuild` is a build/dev-time dependency only — it is
not part of the production runtime (`node build` runs the compiled output). Both
advisories require conditions this project never meets: the first is specific to
the Deno module loader (we run Node, not Deno), and the second is an arbitrary
file read exploitable only against the **Windows** dev server. Development and
production both run on Linux in Docker, so neither advisory is reachable.

**Resolution**: Clears with the planned **Vite 7→8** upgrade (which bumps
`esbuild` past the affected range), coordinated with
`@sveltejs/vite-plugin-svelte` 6→7. Tracked as a deliberate major upgrade, not a
hotfix. `npm audit fix --force` would install `vite@8.0.16` as an unvetted
breaking change.

## cookie <0.7.0 (Low)

- **Advisory**: [GHSA-pxg6-pf52-xh8x](https://github.com/advisories/GHSA-pxg6-pf52-xh8x)
- **Severity**: Low
- **Affected packages**: `@sveltejs/kit`, `@auth/sveltekit`, `@sveltejs/adapter-node`

Cookie name, path, and domain accept out-of-bounds characters, which could
allow cookie field injection if the application also reflects unsanitized
cookie values.

**Why this is acceptable**: SvelteKit 2.x pins `cookie@0.6.0` and every
SvelteKit 2 project has this finding. SvelteKit handles cookie
parsing/serialization internally, so the app is not directly exposed.
Exploiting this requires additional bugs in application code (e.g.,
reflecting raw cookie values into HTML). Running `npm audit fix --force`
would downgrade to `@sveltejs/kit@0.0.30`, breaking the app entirely.

**Resolution**: Two upstream fixes are in flight:

- A non-breaking bump to `cookie@^0.7.0` has been merged
  ([PR #15356](https://github.com/sveltejs/kit/pull/15356), Feb 26 2026)
  but has not yet shipped in a published `@sveltejs/kit` release (latest
  on npm is `2.65.2`, which still depends on `cookie@^0.6.0`). The next
  SvelteKit 2.x patch release that includes it should clear this finding.
- A breaking upgrade to `cookie@^1.0.2` has been merged into SvelteKit's
  `version-3` branch ([PR #13386](https://github.com/sveltejs/kit/pull/13386))
  and will land in SvelteKit 3.0.
