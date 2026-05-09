# Security Audit

Known npm audit findings and their status. Last reviewed: 2026-05-09.

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
  on npm is still `2.59.1`, which depends on `cookie@^0.6.0`). The next
  SvelteKit 2.x patch release should clear this audit finding.
- A breaking upgrade to `cookie@^1.0.2` has been merged into SvelteKit's
  `version-3` branch ([PR #13386](https://github.com/sveltejs/kit/pull/13386))
  and will land in SvelteKit 3.0.
