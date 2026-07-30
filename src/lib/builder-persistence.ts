// Firestore persistence for builder documents.
// Collection: users/{uid}/documents/{docId}

import { doc, setDoc, getDocs, deleteDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BuilderDocument } from './builder-types';

function stripUndefined<T>(obj: T): T {
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

export async function saveBuilderDocument(uid: string, document: BuilderDocument): Promise<void> {
  const sanitized = stripUndefined(document);
  await setDoc(doc(documentsCol(uid), document.id), sanitized);
}

export async function getBuilderDocuments(uid: string): Promise<BuilderDocument[]> {
  const snap = await getDocs(documentsCol(uid));
  return snap.docs.map((d) => d.data() as BuilderDocument);
}

export async function deleteBuilderDocument(uid: string, docId: string): Promise<void> {
  await deleteDoc(doc(documentsCol(uid), docId));
}
