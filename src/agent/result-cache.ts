// src/agent/result-cache.ts
// IndexedDB-backed result cache for the agent loop.
// Stores full query results under result_id; LRU eviction at 200MB.
// Used by run_query tool, affordance controls, and "show underlying data".

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CachedResult {
  result_id: string;
  sql: string;
  schema: Array<{ name: string; type: string }>;
  rows: unknown[][];
  created: number;
  bytes: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DB_NAME = 'bqaif_results';
const DB_VERSION = 1;
const STORE_NAME = 'results';
const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'result_id' });
        store.createIndex('created', 'created', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── ResultCache class ─────────────────────────────────────────────────────────

class ResultCache {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDb().catch(err => {
        this.dbPromise = null;
        throw err;
      });
    }
    return this.dbPromise;
  }

  /** Store a result. Triggers LRU eviction if over budget. */
  async put(result: CachedResult): Promise<void> {
    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(result);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Non-blocking eviction check
      this.evictIfNeeded().catch(() => { /* non-fatal */ });
    } catch {
      // IndexedDB write failure is non-fatal
    }
  }

  /** Retrieve a cached result by ID. */
  async get(resultId: string): Promise<CachedResult | null> {
    try {
      const db = await this.getDb();
      return new Promise<CachedResult | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(resultId);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  /** List all cached result IDs with their creation times and sizes. */
  async list(): Promise<Array<{ result_id: string; created: number; bytes: number }>> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => {
          const results = (request.result as CachedResult[]).map(r => ({
            result_id: r.result_id,
            created: r.created,
            bytes: r.bytes,
          }));
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return [];
    }
  }

  /** Remove a specific result. */
  async remove(resultId: string): Promise<void> {
    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(resultId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Non-fatal
    }
  }

  /** Clear all cached results. */
  async clear(): Promise<void> {
    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Non-fatal
    }
  }

  /** Evict oldest results if total size exceeds MAX_CACHE_BYTES. */
  private async evictIfNeeded(): Promise<void> {
    const entries = await this.list();
    const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);

    if (totalBytes <= MAX_CACHE_BYTES) return;

    // Sort by created (oldest first)
    entries.sort((a, b) => a.created - b.created);

    let freedBytes = 0;
    const target = totalBytes - MAX_CACHE_BYTES;

    for (const entry of entries) {
      if (freedBytes >= target) break;
      await this.remove(entry.result_id);
      freedBytes += entry.bytes;
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const resultCache = new ResultCache();
