// src/lib/firestore-service.ts
// Typed Firestore operations for all user-scoped app data.
// All collections live under /users/{uid}/ — enforced by security rules.

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ChatMessage, CompositionEnvelope } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  project: string;
  messages: ChatMessage[];
}

/** Shape persisted in Firestore — messages are JSON-stringified to avoid
 *  Firestore's nested-array restriction (e.g. rows[][], referencedTables[] inside items[]). */
interface PersistedConversation extends Omit<SavedConversation, 'messages'> {
  messagesJson: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userCol(uid: string, colName: string) {
  return collection(db, 'users', uid, colName);
}

function userDoc(uid: string, colName: string, docId: string) {
  return doc(db, 'users', uid, colName, docId);
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(uid: string): Promise<SavedConversation[]> {
  const q = query(userCol(uid, 'conversations'), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as PersistedConversation & { messages?: ChatMessage[] };
    // Support both legacy docs (messages[]) and new docs (messagesJson)
    const messages: ChatMessage[] = raw.messagesJson
      ? (JSON.parse(raw.messagesJson) as ChatMessage[])
      : (raw.messages ?? []);
    const { messagesJson: _omit, ...rest } = raw as PersistedConversation & { messages?: ChatMessage[] };
    return { ...rest, messages } as SavedConversation;
  });
}

export async function saveConversation(uid: string, conv: SavedConversation): Promise<void> {
  const { messages, ...rest } = conv;
  const persisted: PersistedConversation = {
    ...rest,
    // Serialize messages to JSON string — avoids Firestore nested-array errors
    // (e.g. QueryResult.rows[][], MonitoringJob.referencedTables[] inside items[])
    messagesJson: JSON.stringify(messages),
  };
  await setDoc(userDoc(uid, 'conversations', conv.id), persisted);
}

export async function deleteConversation(uid: string, id: string): Promise<void> {
  await deleteDoc(userDoc(uid, 'conversations', id));
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export async function getFavorites(uid: string): Promise<FavoriteItem[]> {
  const q = query(userCol(uid, 'favorites'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as FavoriteItem & { envelopeJson?: string };
    const envelope = raw.envelopeJson
      ? (JSON.parse(raw.envelopeJson) as CompositionEnvelope)
      : raw.envelope;
    const { envelopeJson: _omit, ...rest } = raw;
    return { ...rest, envelope } as FavoriteItem;
  });
}

export async function addFavorite(uid: string, item: FavoriteItem): Promise<void> {
  const { envelope, ...rest } = item;
  const persisted = {
    ...rest,
    envelopeJson: envelope ? JSON.stringify(envelope) : null,
  };
  await setDoc(userDoc(uid, 'favorites', item.id), persisted);
}

export async function removeFavorite(uid: string, id: string): Promise<void> {
  await deleteDoc(userDoc(uid, 'favorites', id));
}


// ─── Saved Prompts ────────────────────────────────────────────────────────────

export async function getPrompts(uid: string): Promise<SavedPrompt[]> {
  const q = query(userCol(uid, 'prompts'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SavedPrompt);
}

export async function savePrompt(uid: string, prompt: SavedPrompt): Promise<void> {
  await setDoc(userDoc(uid, 'prompts', prompt.id), prompt);
}

export async function deletePrompt(uid: string, id: string): Promise<void> {
  await deleteDoc(userDoc(uid, 'prompts', id));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function generateId(): string {
  return doc(collection(db, '_')).id;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function autoTitle(firstMessage: string): string {
  return firstMessage.length > 52
    ? firstMessage.slice(0, 50).trim() + '…'
    : firstMessage.trim();
}
