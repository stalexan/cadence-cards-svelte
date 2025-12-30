/**
 * Primitive Type Definitions
 *
 * This file re-exports fundamental enums and constants used throughout the type system.
 * These primitives have no dependencies on other type files.
 *
 * DEPENDENCIES: $lib/sm2 (external library)
 * IMPORTED BY: domain.ts, database.ts, api.ts, study.ts
 *
 * Note: The actual enum definitions live in $lib/sm2 because they're tightly coupled
 * to the spaced repetition algorithm implementation. This file serves as documentation
 * and a convenient re-export point for the type system.
 */

// Re-export primitive enums from the SM2 library
export { Grade, Priority } from '$lib/sm2';
export type { CardState } from '$lib/sm2';
