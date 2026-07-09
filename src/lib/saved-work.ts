// src/lib/saved-work.ts
// Unified persistence layer for saved work items.
// Follows the same Firestore patterns as firestore-service.ts.

import { doc, getDoc, setDoc, deleteField, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedItem {
  id: string;
  userId: string;
  type: 'query' | 'view' | 'check' | 'setup' | 'pipeline';
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  data: {
    sql?: string;
    project?: string;
    dataset?: string;
    table?: string;
    schedule?: string;
    checkType?: string;
    context?: Record<string, unknown>;
  };
  tags?: string[];
  pinned?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function userDoc(uid: string) {
  return doc(db, 'users', uid);
}

async function getUserData(uid: string): Promise<Record<string, unknown>> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : {};
}

function generateId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowISO(): string {
  return new Date().toISOString();
}

// ── CRUD Operations ──────────────────────────────────────────────────────────

export async function saveItem(
  userId: string,
  item: Omit<SavedItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  const savedItem: SavedItem = {
    ...item,
    id,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(userDoc(userId), {
    savedWork: { [id]: savedItem },
  }, { merge: true });
  return id;
}

export async function getItems(
  userId: string,
  type?: SavedItem['type']
): Promise<SavedItem[]> {
  const state = await getUserData(userId);
  const workMap = (state.savedWork || {}) as Record<string, SavedItem>;
  let items: SavedItem[] = Object.entries(workMap).map(([id, data]) => ({
    ...data,
    id,
  }));
  if (type) {
    items = items.filter((item) => item.type === type);
  }
  return items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getItem(
  userId: string,
  itemId: string
): Promise<SavedItem | null> {
  const state = await getUserData(userId);
  const workMap = (state.savedWork || {}) as Record<string, SavedItem>;
  const item = workMap[itemId];
  return item ? { ...item, id: itemId } : null;
}

export async function updateItem(
  userId: string,
  itemId: string,
  updates: Partial<SavedItem>
): Promise<void> {
  const state = await getUserData(userId);
  const workMap = (state.savedWork || {}) as Record<string, SavedItem>;
  const existing = workMap[itemId];
  if (!existing) return;
  const updated = {
    ...existing,
    ...updates,
    id: itemId,
    updatedAt: nowISO(),
  };
  await setDoc(userDoc(userId), {
    savedWork: { [itemId]: updated },
  }, { merge: true });
}

export async function deleteItem(
  userId: string,
  itemId: string
): Promise<void> {
  await updateDoc(userDoc(userId), {
    [`savedWork.${itemId}`]: deleteField(),
  });
}

export async function getPinnedItems(userId: string): Promise<SavedItem[]> {
  const items = await getItems(userId);
  return items.filter((item) => item.pinned === true);
}

export async function searchItems(
  userId: string,
  query: string
): Promise<SavedItem[]> {
  const items = await getItems(userId);
  const lower = query.toLowerCase();
  return items.filter((item) => {
    const nameMatch = item.name.toLowerCase().includes(lower);
    const descMatch = item.description?.toLowerCase().includes(lower) || false;
    const sqlMatch = item.data.sql?.toLowerCase().includes(lower) || false;
    const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(lower)) || false;
    return nameMatch || descMatch || sqlMatch || tagMatch;
  });
}
