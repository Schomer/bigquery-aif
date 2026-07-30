// src/lib/firestore-service.ts
// Client-side Firestore operations using Firebase client SDK directly.

import { doc, getDoc, setDoc, deleteField, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { ChatMessage, CompositionEnvelope, SavedCheck } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  project: string;
  messages: ChatMessage[];
}

export interface FavoriteItem {
  id: string;
  createdAt: string;
  label: string;
  type: 'message' | 'query' | 'table' | 'chart';
  envelope?: CompositionEnvelope;
  tableRef?: string;
}

export interface SavedPrompt {
  id: string;
  createdAt: string;
  label: string;
  prompt: string;
  category: 'Reporting' | 'Data Quality' | 'Schema' | 'Cost' | 'Other';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function userDoc(uid: string) {
  return doc(db, 'users', uid);
}

async function getUserData(uid: string): Promise<any> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? snap.data() : {};
}

// ── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(uid: string): Promise<SavedConversation[]> {
  const state = await getUserData(uid);
  const convMap = state.conversations || {};
  const conversations: SavedConversation[] = Object.entries(convMap).map(([id, data]: [string, any]) => {
    const messages: ChatMessage[] = data.messagesJson
      ? (JSON.parse(data.messagesJson) as ChatMessage[])
      : (data.messages ?? []);
    return { ...data, id, messages };
  });
  return conversations.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function saveConversation(uid: string, conv: SavedConversation): Promise<void> {
  const { messages, ...rest } = conv;
  const persisted = {
    ...rest,
    messagesJson: JSON.stringify(messages),
  };
  await setDoc(userDoc(uid), {
    conversations: { [conv.id]: persisted },
  }, { merge: true });
}

export async function deleteConversation(uid: string, id: string): Promise<void> {
  await updateDoc(userDoc(uid), {
    [`conversations.${id}`]: deleteField(),
  });
}

// ── Favorites ────────────────────────────────────────────────────────────────

export async function getFavorites(uid: string): Promise<FavoriteItem[]> {
  const state = await getUserData(uid);
  const favMap = state.favorites || {};
  const favorites: FavoriteItem[] = Object.entries(favMap).map(([id, data]: [string, any]) => {
    const envelope = data.envelopeJson
      ? (JSON.parse(data.envelopeJson) as CompositionEnvelope)
      : data.envelope;
    return { ...data, id, envelope };
  });
  return favorites.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function addFavorite(uid: string, item: FavoriteItem): Promise<void> {
  const { envelope, ...rest } = item;
  const persisted = {
    ...rest,
    envelopeJson: envelope ? JSON.stringify(envelope) : null,
  };
  await setDoc(userDoc(uid), {
    favorites: { [item.id]: persisted },
  }, { merge: true });
}

export async function removeFavorite(uid: string, id: string): Promise<void> {
  await updateDoc(userDoc(uid), {
    [`favorites.${id}`]: deleteField(),
  });
}

// ── Saved Prompts ────────────────────────────────────────────────────────────

export async function getPrompts(uid: string): Promise<SavedPrompt[]> {
  const state = await getUserData(uid);
  const promptMap = state.prompts || {};
  const prompts: SavedPrompt[] = Object.entries(promptMap).map(([id, data]: [string, any]) => {
    return { ...data, id };
  });
  return prompts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function savePrompt(uid: string, prompt: SavedPrompt): Promise<void> {
  await setDoc(userDoc(uid), {
    prompts: { [prompt.id]: prompt },
  }, { merge: true });
}

export async function deletePrompt(uid: string, id: string): Promise<void> {
  await updateDoc(userDoc(uid), {
    [`prompts.${id}`]: deleteField(),
  });
}

export async function saveQuery(uid: string, label: string, sql: string): Promise<string> {
  const id = generateId();
  const prompt: SavedPrompt = {
    id,
    createdAt: nowISO(),
    label,
    prompt: sql,
    category: 'Reporting',
  };
  await savePrompt(uid, prompt);
  return id;
}

// ── Saved Checks (Alerting Tier 0/1) ─────────────────────────────────────────

export async function saveCheck(uid: string, check: SavedCheck): Promise<void> {
  await setDoc(userDoc(uid), {
    checks: { [check.id]: check },
  }, { merge: true });
}

export async function getChecks(uid: string): Promise<SavedCheck[]> {
  const state = await getUserData(uid);
  const checkMap = state.checks || {};
  const checks: SavedCheck[] = Object.entries(checkMap).map(([id, data]: [string, any]) => {
    return { ...data, id };
  });
  return checks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function deleteCheck(uid: string, id: string): Promise<void> {
  await updateDoc(userDoc(uid), {
    [`checks.${id}`]: deleteField(),
  });
}

// ── User Preferences ─────────────────────────────────────────────────────────

export interface UserPreferences {
  activeProject?: string;
}

export async function getUserPreferences(uid: string): Promise<UserPreferences> {
  try {
    const state = await getUserData(uid);
    return state.preferences || {};
  } catch (err) {
    console.warn('[getUserPreferences]', err);
    return {};
  }
}

export async function saveUserPreferences(uid: string, prefs: Partial<UserPreferences>): Promise<void> {
  try {
    await setDoc(userDoc(uid), { preferences: prefs }, { merge: true });
  } catch (err) {
    console.warn('[saveUserPreferences]', err);
  }
}

// ── Favorite Projects ────────────────────────────────────────────────────────

export async function getFavoriteProjects(uid: string): Promise<string[]> {
  try {
    const state = await getUserData(uid);
    return state.favoriteProjects || [];
  } catch (err) {
    console.warn('[getFavoriteProjects]', err);
    return [];
  }
}

export async function saveFavoriteProjects(uid: string, projectIds: string[]): Promise<void> {
  try {
    await setDoc(userDoc(uid), { favoriteProjects: projectIds }, { merge: true });
  } catch (err) {
    console.warn('[saveFavoriteProjects]', err);
  }
}

// ── Recent Datasets / Tables ─────────────────────────────────────────────────

export interface RecentItem {
  type: 'dataset' | 'table';
  name: string;
  dataset?: string;       // parent dataset (for tables)
  project?: string;       // source project
  lastUsed: string;       // ISO timestamp
}

const RECENT_ITEMS_KEY = 'hdn_recent_items';
const RECENT_ITEMS_LIMIT = 12;

/** Read the localStorage recent-items cache. */
export function getRecentItemsFromCache(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_KEY);
    if (raw) return JSON.parse(raw) as RecentItem[];
  } catch { /* ignore */ }
  return [];
}

/** Write the localStorage recent-items cache. */
function setRecentItemsCache(items: RecentItem[]): void {
  try {
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(items.slice(0, RECENT_ITEMS_LIMIT)));
  } catch { /* ignore */ }
}

/**
 * Extract dataset/table references from a set of envelopes and merge
 * them into the localStorage cache. Returns the updated list.
 */
export function updateRecentItemsFromEnvelopes(
  envelopes: import('./types').CompositionEnvelope[],
): RecentItem[] {
  const now = new Date().toISOString();
  const newItems: RecentItem[] = [];

  for (const env of envelopes) {
    const data = env.primaryArtifact?.data as Record<string, unknown> | null;

    // Extract dataset from artifact data
    if (data?.dataset && typeof data.dataset === 'string') {
      const proj = typeof data.project === 'string' ? data.project : undefined;
      newItems.push({ type: 'dataset', name: data.dataset, project: proj, lastUsed: now });
    }

    // Extract table from artifact data
    if (data?.table && typeof data.table === 'string') {
      const raw = (data.table as string).replace(/`/g, '');
      const parts = raw.split('.');
      const tableName = parts[parts.length - 1];
      const parentDataset = parts.length >= 2 ? parts[parts.length - 2] : (data.dataset as string | undefined);
      const proj = typeof data.project === 'string' ? data.project : (parts.length >= 3 ? parts[0] : undefined);
      newItems.push({ type: 'table', name: tableName, dataset: parentDataset, project: proj, lastUsed: now });
    }

    // Extract from SQL FROM clauses
    const sql = env.provenance?.sql || (data?.sql as string | undefined);
    if (sql && typeof sql === 'string') {
      const fromRe = /\bFROM\s+`?([A-Za-z0-9_.-]+)`?/gi;
      let match: RegExpExecArray | null;
      while ((match = fromRe.exec(sql)) !== null) {
        const parts = match[1].split('.');
        if (parts.length >= 2) {
          const tableName = parts[parts.length - 1];
          const parentDs = parts[parts.length - 2];
          // Skip INFORMATION_SCHEMA references
          if (parentDs === 'INFORMATION_SCHEMA' || tableName === 'INFORMATION_SCHEMA') continue;
          const proj = parts.length >= 3 ? parts[0] : undefined;
          newItems.push({ type: 'table', name: tableName, dataset: parentDs, project: proj, lastUsed: now });
        }
      }
    }
  }

  if (newItems.length === 0) return getRecentItemsFromCache();

  // Merge with existing cache: new items go to front, dedup by key
  const existing = getRecentItemsFromCache();
  const seen = new Set<string>();
  const merged: RecentItem[] = [];

  for (const item of [...newItems, ...existing]) {
    const key = item.type === 'table'
      ? `table:${item.dataset || ''}:${item.name}`
      : `dataset:${item.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  // Tables before datasets at equal priority, limit
  const sorted = merged.slice(0, RECENT_ITEMS_LIMIT);
  setRecentItemsCache(sorted);
  return sorted;
}

/**
 * Get recent dataset/table items. Reads from localStorage first (instant).
 * Falls back to mining Firestore conversations if localStorage is empty.
 */
export async function getRecentDatasets(uid: string, limit = 8): Promise<RecentItem[]> {
  // Fast path: localStorage cache
  const cached = getRecentItemsFromCache();
  if (cached.length > 0) return cached.slice(0, limit);

  // Slow path: mine from Firestore (one-time backfill)
  try {
    const convs = await getConversations(uid);
    const seen = new Map<string, RecentItem>();

    for (const conv of convs) {
      const ts = conv.updatedAt || conv.createdAt;
      for (const msg of conv.messages) {
        if (msg.role !== 'assistant' || !msg.envelopes) continue;
        for (const env of msg.envelopes) {
          const data = env.primaryArtifact?.data as Record<string, unknown> | null;

          if (data?.dataset && typeof data.dataset === 'string') {
            const key = `dataset:${data.dataset}`;
            if (!seen.has(key)) {
              seen.set(key, { type: 'dataset', name: data.dataset, lastUsed: ts });
            }
          }

          if (data?.table && typeof data.table === 'string') {
            const raw = (data.table as string).replace(/`/g, '');
            const parts = raw.split('.');
            const tableName = parts[parts.length - 1];
            const parentDataset = parts.length >= 2 ? parts[parts.length - 2] : (data.dataset as string | undefined);
            const key = `table:${parentDataset || ''}:${tableName}`;
            if (!seen.has(key)) {
              seen.set(key, { type: 'table', name: tableName, dataset: parentDataset, lastUsed: ts });
            }
          }

          const sql = env.provenance?.sql || (data?.sql as string | undefined);
          if (sql && typeof sql === 'string') {
            const fromRe = /\bFROM\s+`?([A-Za-z0-9_.-]+)`?/gi;
            let match: RegExpExecArray | null;
            while ((match = fromRe.exec(sql)) !== null) {
              const parts = match[1].split('.');
              if (parts.length >= 2) {
                const tableName = parts[parts.length - 1];
                const parentDs = parts[parts.length - 2];
                if (parentDs === 'INFORMATION_SCHEMA' || tableName === 'INFORMATION_SCHEMA') continue;
                const key = `table:${parentDs}:${tableName}`;
                if (!seen.has(key)) {
                  seen.set(key, { type: 'table', name: tableName, dataset: parentDs, lastUsed: ts });
                }
              }
            }
          }
        }
      }
    }

    const items = Array.from(seen.values())
      .sort((a, b) => {
        const cmp = b.lastUsed.localeCompare(a.lastUsed);
        if (cmp !== 0) return cmp;
        return a.type === 'table' ? -1 : 1;
      })
      .slice(0, RECENT_ITEMS_LIMIT);

    // Seed localStorage for future fast reads
    setRecentItemsCache(items);
    return items.slice(0, limit);
  } catch (err) {
    console.warn('[getRecentDatasets] Firestore backfill failed:', err);
    return [];
  }
}

// ── Schema Baselines (for schema drift detection) ──────────────────────────

export interface SchemaBaselineColumn {
  name: string;
  type: string;
  mode: string;
}

export interface SchemaBaseline {
  tableRef: string;          // e.g. "project.dataset.table"
  columns: SchemaBaselineColumn[];
  capturedAt: string;        // ISO timestamp
}

/**
 * Save a schema baseline for a table. Called on first DQ run.
 * Stored in users/{uid}/schemaBaselines as a map keyed by tableRef.
 */
export async function saveSchemaBaseline(uid: string, baseline: SchemaBaseline): Promise<void> {
  try {
    const key = baseline.tableRef.replace(/[.`]/g, '_');
    await setDoc(userDoc(uid), {
      schemaBaselines: { [key]: baseline },
    }, { merge: true });
  } catch (err) {
    console.warn('[saveSchemaBaseline]', err);
  }
}

/**
 * Retrieve a stored schema baseline for a table.
 * Returns null if no baseline exists yet.
 */
export async function getSchemaBaseline(uid: string, tableRef: string): Promise<SchemaBaseline | null> {
  try {
    const data = await getUserData(uid);
    const key = tableRef.replace(/[.`]/g, '_');
    return (data?.schemaBaselines?.[key] as SchemaBaseline) ?? null;
  } catch {
    return null;
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function autoTitle(firstMessage: string): string {
  return firstMessage.length > 52
    ? firstMessage.slice(0, 50).trim() + '...'
    : firstMessage.trim();
}

