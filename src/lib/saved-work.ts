// src/lib/saved-work.ts
// Unified persistence layer for saved artifacts.
// Follows the same Firestore patterns as firestore-service.ts.

import { doc, getDoc, setDoc, deleteDoc, deleteField, updateDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import type {
  SavedArtifact,
  SavedArtifactType,
  ParameterDef,
  ArtifactStep,
  SkillName,
  Space,
  SharedArtifactSummary,
} from './types';

// Re-export for consumers
export type { SavedArtifact, SavedArtifactType, ParameterDef, Space, SharedArtifactSummary } from './types';

// ── Legacy type alias (deprecated) ──────────────────────────────────────────

/** @deprecated Use SavedArtifact instead */
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

// ── Migration ────────────────────────────────────────────────────────────────

/** Convert a legacy SavedItem record into a SavedArtifact. */
export function migrateItem(raw: Record<string, unknown>): SavedArtifact {
  const oldType = (raw.type as string) || 'query';
  let newType: SavedArtifactType;
  switch (oldType) {
    case 'view':
    case 'check':
    case 'setup':
      newType = 'workflow';
      break;
    case 'pipeline':
      newType = 'pipeline';
      break;
    default:
      newType = 'query';
  }

  const data = (raw.data as Record<string, unknown>) || {};
  const steps: ArtifactStep[] = [];

  if (data.sql) {
    steps.push({
      id: generateId(),
      order: 0,
      skill: 'query' as SkillName,
      prompt: (raw.name as string) || '',
      cachedSql: data.sql as string,
    });
  }

  const now = nowISO();
  return {
    id: (raw.id as string) || generateId(),
    userId: (raw.userId as string) || '',
    type: newType,
    name: (raw.name as string) || 'Untitled',
    description: (raw.description as string) || '',
    steps,
    parameters: [],
    createdAt: (raw.createdAt as string) || now,
    updatedAt: (raw.updatedAt as string) || now,
    project: data.project as string | undefined,
    dataset: data.dataset as string | undefined,
    tags: (raw.tags as string[]) || [],
    pinned: (raw.pinned as boolean) || false,
    runCount: 0,
  };
}

// ── Internal: read / detect format ──────────────────────────────────────────

function isNewFormat(record: Record<string, unknown>): boolean {
  return Array.isArray(record.steps);
}

function toArtifact(id: string, record: Record<string, unknown>): SavedArtifact {
  if (isNewFormat(record)) {
    return { ...record, id } as SavedArtifact;
  }
  return migrateItem({ ...record, id });
}

// ── New CRUD Operations ──────────────────────────────────────────────────────

export async function saveArtifact(
  userId: string,
  artifact: Omit<SavedArtifact, 'id' | 'createdAt' | 'updatedAt' | 'runCount'>
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  const saved: SavedArtifact = {
    ...artifact,
    id,
    createdAt: now,
    updatedAt: now,
    runCount: 0,
  };
  await setDoc(userDoc(userId), {
    savedWork: { [id]: saved },
  }, { merge: true });
  return id;
}

export async function getArtifacts(
  userId: string,
  type?: SavedArtifactType
): Promise<SavedArtifact[]> {
  const state = await getUserData(userId);
  const workMap = (state.savedWork || {}) as Record<string, Record<string, unknown>>;
  let items: SavedArtifact[] = Object.entries(workMap).map(
    ([id, data]) => toArtifact(id, data)
  );
  if (type) {
    items = items.filter((item) => item.type === type);
  }
  return items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getArtifact(
  userId: string,
  artifactId: string
): Promise<SavedArtifact | null> {
  const state = await getUserData(userId);
  const workMap = (state.savedWork || {}) as Record<string, Record<string, unknown>>;
  const record = workMap[artifactId];
  return record ? toArtifact(artifactId, record) : null;
}

export async function updateArtifact(
  userId: string,
  artifactId: string,
  updates: Partial<SavedArtifact>
): Promise<void> {
  const state = await getUserData(userId);
  const workMap = (state.savedWork || {}) as Record<string, Record<string, unknown>>;
  const existing = workMap[artifactId];
  if (!existing) return;
  const current = toArtifact(artifactId, existing);
  const updated: SavedArtifact = {
    ...current,
    ...updates,
    id: artifactId,
    updatedAt: nowISO(),
  };
  await setDoc(userDoc(userId), {
    savedWork: { [artifactId]: updated },
  }, { merge: true });
}

export async function deleteArtifact(
  userId: string,
  artifactId: string
): Promise<void> {
  await updateDoc(userDoc(userId), {
    [`savedWork.${artifactId}`]: deleteField(),
  });
}

export async function searchArtifacts(
  userId: string,
  query: string
): Promise<SavedArtifact[]> {
  const items = await getArtifacts(userId);
  const lower = query.toLowerCase();
  return items.filter((item) => {
    const nameMatch = item.name.toLowerCase().includes(lower);
    const descMatch = item.description?.toLowerCase().includes(lower) || false;
    const sqlMatch = item.steps.some(
      (s) => s.cachedSql?.toLowerCase().includes(lower)
    ) || false;
    const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(lower)) || false;
    return nameMatch || descMatch || sqlMatch || tagMatch;
  });
}

export async function recordRun(
  userId: string,
  artifactId: string
): Promise<void> {
  const artifact = await getArtifact(userId, artifactId);
  if (!artifact) return;
  await updateArtifact(userId, artifactId, {
    runCount: artifact.runCount + 1,
    lastRunAt: nowISO(),
  });
}

export async function getPinnedArtifacts(userId: string): Promise<SavedArtifact[]> {
  const items = await getArtifacts(userId);
  return items.filter((item) => item.pinned === true);
}

// ── Sharing Operations ────────────────────────────────────────────────────────

function sharedDoc(artifactId: string) {
  return doc(db, 'sharedWork', artifactId);
}

/**
 * Makes an artifact publicly visible to all authenticated users.
 * Writes a full copy (including SQL) to the top-level `sharedWork/{id}` collection
 * and marks `isPublic: true` on the owner's personal copy.
 */
export async function publishArtifact(
  userId: string,
  artifactId: string,
  ownerEmail: string,
): Promise<void> {
  const artifact = await getArtifact(userId, artifactId);
  if (!artifact) return;
  const sharedCopy: SharedArtifactSummary = {
    ...artifact,
    isPublic: true,
    ownerEmail,
    sharedAt: nowISO(),
  };
  // Write the shared copy first, then update the owner's record
  await setDoc(sharedDoc(artifactId), sharedCopy);
  await updateArtifact(userId, artifactId, { isPublic: true, ownerEmail });
}

/**
 * Removes an artifact from the public shared gallery.
 * Deletes the `sharedWork/{id}` document and marks `isPublic: false` on the owner's copy.
 */
export async function unpublishArtifact(
  userId: string,
  artifactId: string,
): Promise<void> {
  await deleteDoc(sharedDoc(artifactId));
  await updateArtifact(userId, artifactId, { isPublic: false });
}

/**
 * Returns public artifacts shared by all users.
 * Reads from the top-level `sharedWork` collection (any authenticated user can read).
 * Results are ordered by sharedAt descending, capped at 100.
 */
export async function getSharedArtifacts(): Promise<SharedArtifactSummary[]> {
  const q = query(
    collection(db, 'sharedWork'),
    orderBy('sharedAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SharedArtifactSummary);
}

// ── Space CRUD Operations ───────────────────────────────────────────────────────

export async function createSpace(
  userId: string,
  name: string
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  const space: Space = { id, name, createdAt: now, updatedAt: now };
  await setDoc(userDoc(userId), {
    spaces: { [id]: space },
  }, { merge: true });
  return id;
}

export async function getSpaces(userId: string): Promise<Space[]> {
  const state = await getUserData(userId);
  const spaceMap = (state.spaces || {}) as Record<string, Space>;
  return Object.values(spaceMap).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
}

export async function renameSpace(
  userId: string,
  spaceId: string,
  newName: string
): Promise<void> {
  const state = await getUserData(userId);
  const spaceMap = (state.spaces || {}) as Record<string, Space>;
  const existing = spaceMap[spaceId];
  if (!existing) return;
  const updated: Space = { ...existing, name: newName, updatedAt: nowISO() };
  await setDoc(userDoc(userId), {
    spaces: { [spaceId]: updated },
  }, { merge: true });
}

export async function deleteSpace(
  userId: string,
  spaceId: string
): Promise<void> {
  // Move all items in this space back to root
  const items = await getArtifacts(userId);
  const inSpace = items.filter((i) => i.spaceId === spaceId);
  for (const item of inSpace) {
    await updateArtifact(userId, item.id, { spaceId: undefined });
  }
  // Delete the space entry
  await updateDoc(userDoc(userId), {
    [`spaces.${spaceId}`]: deleteField(),
  });
}

// ── Artifact Utilities ────────────────────────────────────────────────────────

export async function moveToSpace(
  userId: string,
  artifactId: string,
  spaceId: string | undefined
): Promise<void> {
  await updateArtifact(userId, artifactId, { spaceId });
}

export async function duplicateArtifact(
  userId: string,
  artifactId: string
): Promise<string | null> {
  const original = await getArtifact(userId, artifactId);
  if (!original) return null;
  const { id: _id, createdAt: _ca, updatedAt: _ua, runCount: _rc, lastRunAt: _lr, ...rest } = original;
  return saveArtifact(userId, {
    ...rest,
    name: `${original.name} (copy)`,
  });
}

// ── Deprecated wrappers (old API surface) ────────────────────────────────────

/** @deprecated Use saveArtifact instead */
export async function saveItem(
  userId: string,
  item: Omit<SavedItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const migrated = migrateItem({ ...item, userId });
  return saveArtifact(userId, migrated);
}

/** @deprecated Use getArtifacts instead */
export async function getItems(
  userId: string,
  type?: SavedItem['type']
): Promise<SavedItem[]> {
  // Map old types to new types for filtering
  const artifacts = await getArtifacts(userId);
  if (!type) return artifacts as unknown as SavedItem[];
  // Filter by matching original type mapping
  return artifacts.filter((a) => {
    if (type === 'query') return a.type === 'query';
    if (type === 'pipeline') return a.type === 'pipeline';
    // view, check, setup all map to workflow
    return a.type === 'workflow';
  }) as unknown as SavedItem[];
}

/** @deprecated Use getArtifact instead */
export async function getItem(
  userId: string,
  itemId: string
): Promise<SavedItem | null> {
  return getArtifact(userId, itemId) as unknown as SavedItem | null;
}

/** @deprecated Use updateArtifact instead */
export async function updateItem(
  userId: string,
  itemId: string,
  updates: Partial<SavedItem>
): Promise<void> {
  return updateArtifact(userId, itemId, updates as unknown as Partial<SavedArtifact>);
}

/** @deprecated Use deleteArtifact instead */
export async function deleteItem(
  userId: string,
  itemId: string
): Promise<void> {
  return deleteArtifact(userId, itemId);
}

/** @deprecated Use searchArtifacts instead */
export async function searchItems(
  userId: string,
  query: string
): Promise<SavedItem[]> {
  return searchArtifacts(userId, query) as unknown as SavedItem[];
}

/** @deprecated Use getPinnedArtifacts instead */
export async function getPinnedItems(userId: string): Promise<SavedItem[]> {
  return getPinnedArtifacts(userId) as unknown as SavedItem[];
}
