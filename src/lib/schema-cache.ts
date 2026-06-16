// src/lib/schema-cache.ts
// In-memory schema cache implementing the contract from bigquery-skill-schema.md §7
//
// Cache key: "project.dataset.table" (or "project.dataset" / "project")
// What's cached: columns, partitioning, clustering, description, labels, tableConstraints
// What's NOT cached: rowCount, sizeBytes, lastModifiedTime (always fetched fresh)
// TTL: 1 hour (fallback if invalidation signals are missed)
// Invalidation: explicit signal from Data Management after DDL ops

import type { SchemaResult } from './types';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  result: SchemaResult;
  cachedAt: number;
}

// Module-level singleton — persists across requests in the same Node.js process
const cache = new Map<string, CacheEntry>();

export function getCacheKey(
  project: string,
  dataset?: string | null,
  table?: string | null
): string {
  const parts = [project];
  if (dataset) parts.push(dataset);
  if (table) parts.push(table);
  return parts.join('.');
}

export function getFromCache(key: string): SchemaResult | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.cachedAt;
  if (age > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.result;
}

export function setInCache(key: string, result: SchemaResult): void {
  cache.set(key, {
    result,
    cachedAt: Date.now(),
  });
}

/**
 * Invalidate cache entries for a table or dataset after DDL operations.
 * Called by Data Management skill after successful DDL.
 * Accepts fully-qualified identifiers like "project.dataset.table"
 */
export function invalidateCache(qualifiedName: string): void {
  // Invalidate the exact key and any parent keys that might be stale
  cache.delete(qualifiedName);

  // Also invalidate the dataset-level key (its table list may have changed)
  const parts = qualifiedName.split('.');
  if (parts.length === 3) {
    cache.delete(`${parts[0]}.${parts[1]}`); // dataset level
  }
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
