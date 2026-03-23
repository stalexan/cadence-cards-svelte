# Security Audit

Known npm audit findings and their status. Last reviewed: 2026-03-23.

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

**Resolution**: The fix (upgrading to `cookie@^1.0.2`) has been merged into
SvelteKit's `version-3` branch ([PR #13386](https://github.com/sveltejs/kit/pull/13386)).
This will be resolved by upgrading to SvelteKit 3.0 when it ships.

## effect <3.20.0 (High)

- **Advisory**: [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g)
- **Severity**: High
- **Affected packages**: `prisma` (via `@prisma/config` -> `effect`)

AsyncLocalStorage context can be lost or contaminated inside Effect fibers
under concurrent load with RPC.

**Why this is acceptable**: The vulnerable `effect` package is a transitive
dependency of `prisma`, the CLI tool, which is a **dev dependency**. It does
not run in the production application -- only during migrations, client
generation, etc. `@prisma/client` (the runtime library) is not affected.
The specific scenario (concurrent Effect fibers with RPC) does not apply to
how Prisma CLI is used. Running `npm audit fix --force` would downgrade to
`prisma@6.12.0`, a breaking change.

**Resolution**: Re-evaluate when upgrading to the next major Prisma version.
