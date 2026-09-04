// src/agent/result-cache.ts
// IndexedDB-backed result cache for the agent loop.
// Two stores:
//   1. 'results' -- LRU cache at 200MB, used by run_query tool during a session
//   2. 'persistent_results' -- long-lived store at 500MB, used to rehydrate
//      conversation envelopes on page reload so charts are not blank

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CachedResult {
  result_id: string;
  sql: string;
  schema: Array<{ name: string; type: string }>;
  rows: unknown[][];
  created: number;
  bytes: number;
}

export interface PersistedResult {
  id: string;            // matches envelope.id
  rows: unknown[][];
  columns: string[];
  columnTypes?: string[];
  csvContent?: string;
  created: number;
  bytes: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DB_NAME = 'bqaif_results';
const DB_VERSION = 2;
const STORE_NAME = 'results';
const PERSISTENT_STORE = 'persistent_results';
const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_PERSISTENT_BYTES = 500 * 1024 * 1024; // 500 MB

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
      if (!db.objectStoreNames.contains(PERSISTENT_STORE)) {
        const pStore = db.createObjectStore(PERSISTENT_STORE, { keyPath: 'id' });
        pStore.createIndex('created', 'created', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Shared DB promise ─────────────────────────────────────────────────────────

let sharedDbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!sharedDbPromise) {
    sharedDbPromise = openDb().catch(err => {
      sharedDbPromise = null;
      throw err;
    });
  }
  return sharedDbPromise;
}

// ── ResultCache class (LRU, session-scoped) ───────────────────────────────────

class ResultCache {
  /** Store a result. Triggers LRU eviction if over budget. */
  async put(result: CachedResult): Promise<void> {
    try {
      const db = await getDb();
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
      const db = await getDb();
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
      const db = await getDb();
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
      const db = await getDb();
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
      const db = await getDb();
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

// ── PersistentResultCache (long-lived, for conversation rehydration) ──────────

class PersistentResultCache {
  /** Store result rows for an envelope. */
  async put(entry: PersistedResult): Promise<void> {
    try {
      const db = await getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PERSISTENT_STORE, 'readwrite');
        tx.objectStore(PERSISTENT_STORE).put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      this.evictIfNeeded().catch(() => { /* non-fatal */ });
    } catch {
      // Non-fatal
    }
  }

  /** Retrieve persisted result by envelope ID. */
  async get(id: string): Promise<PersistedResult | null> {
    try {
      const db = await getDb();
      return new Promise<PersistedResult | null>((resolve, reject) => {
        const tx = db.transaction(PERSISTENT_STORE, 'readonly');
        const request = tx.objectStore(PERSISTENT_STORE).get(id);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  /** Batch-get multiple results by ID. */
  async getMany(ids: string[]): Promise<Map<string, PersistedResult>> {
    const map = new Map<string, PersistedResult>();
    if (ids.length === 0) return map;
    try {
      const db = await getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PERSISTENT_STORE, 'readonly');
        const store = tx.objectStore(PERSISTENT_STORE);
        let remaining = ids.length;
        for (const id of ids) {
          const req = store.get(id);
          req.onsuccess = () => {
            if (req.result) map.set(id, req.result);
            remaining--;
            if (remaining === 0) resolve();
          };
          req.onerror = () => {
            remaining--;
            if (remaining === 0) resolve();
          };
        }
      });
    } catch {
      // Non-fatal
    }
    return map;
  }

  /** List all entries for eviction. */
  private async list(): Promise<Array<{ id: string; created: number; bytes: number }>> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(PERSISTENT_STORE, 'readonly');
        const request = tx.objectStore(PERSISTENT_STORE).getAll();
        request.onsuccess = () => {
          const results = (request.result as PersistedResult[]).map(r => ({
            id: r.id,
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

  /** Remove a specific entry. */
  private async remove(id: string): Promise<void> {
    try {
      const db = await getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PERSISTENT_STORE, 'readwrite');
        tx.objectStore(PERSISTENT_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Non-fatal
    }
  }

  /** Evict oldest entries if total exceeds MAX_PERSISTENT_BYTES. */
  private async evictIfNeeded(): Promise<void> {
    const entries = await this.list();
    const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
    if (totalBytes <= MAX_PERSISTENT_BYTES) return;

    entries.sort((a, b) => a.created - b.created);
    let freedBytes = 0;
    const target = totalBytes - MAX_PERSISTENT_BYTES;

    for (const entry of entries) {
      if (freedBytes >= target) break;
      await this.remove(entry.id);
      freedBytes += entry.bytes;
    }
  }
}

// ── Singletons ────────────────────────────────────────────────────────────────

export const resultCache = new ResultCache();
export const persistentResultCache = new PersistentResultCache();
