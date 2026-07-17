// src/lib/regex-utils.ts
// Shared regex utility used by router.ts and sql-guard.ts.

/**
 * Escapes special regex metacharacters in a string so it can be
 * safely interpolated into a RegExp constructor.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
