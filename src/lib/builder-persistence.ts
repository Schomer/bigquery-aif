// Firestore persistence for builder documents.
// Collection: users/{uid}/documents/{docId}

import { doc, setDoc, getDocs, getDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BuilderDocument } from './builder-types';

export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== undefined) {
      clean[k] = typeof v === 'object' && v !== null ? stripUndefined(v) : v;
    }
  }
  return clean as T;
}

function documentsCol(uid: string) {
  return collection(db, 'users', uid, 'documents');
}

/**
 * Prepares a BuilderDocument for Firestore storage without nested array rejection.
 * Serializes the full object tree to `docJson` while indexing top-level scalar fields.
 */
export function serializeDocumentPayload(uid: string, document: BuilderDocument): Record<string, unknown> {
  const sanitized = stripUndefined(document);
  const docJson = JSON.stringify(sanitized);
  return {
    id: document.id,
    userId: uid,
    type: document.type,
    name: document.name,
    description: document.description || '',
    project: document.project || '',
    density: document.density || 'standard',
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    tags: Array.isArray(document.tags) ? document.tags : [],
    spaceId: document.spaceId || '',
    thumbnailUrl: document.thumbnailUrl || '',
    tileCount: document.tiles?.length || 0,
    docJson,
  };
}

/**
 * Reconstructs a BuilderDocument from Firestore data.
 */
export function deserializeDocumentPayload(data: Record<string, unknown>, fallbackUid = ''): BuilderDocument {
  if (typeof data.docJson === 'string') {
    try {
      const parsed = JSON.parse(data.docJson) as BuilderDocument;
      return {
        ...parsed,
        id: (data.id as string) || parsed.id,
        userId: (data.userId as string) || parsed.userId || fallbackUid,
      };
    } catch (err) {
      console.warn('Failed to parse docJson for builder doc:', data.id, err);
    }
  }
  return data as unknown as BuilderDocument;
}

export async function saveBuilderDocument(uid: string, document: BuilderDocument): Promise<void> {
  const payload = serializeDocumentPayload(uid, document);
  await setDoc(doc(documentsCol(uid), document.id), payload);
}

export async function getBuilderDocuments(uid: string): Promise<BuilderDocument[]> {
  const snap = await getDocs(documentsCol(uid));
  return snap.docs.map((d) => deserializeDocumentPayload(d.data() as Record<string, unknown>, uid));
}

export async function getBuilderDocument(uid: string, docId: string): Promise<BuilderDocument | null> {
  const snap = await getDoc(doc(documentsCol(uid), docId));
  if (!snap.exists()) return null;
  return deserializeDocumentPayload(snap.data() as Record<string, unknown>, uid);
}

export async function deleteBuilderDocument(uid: string, docId: string): Promise<void> {
  await deleteDoc(doc(documentsCol(uid), docId));
}

