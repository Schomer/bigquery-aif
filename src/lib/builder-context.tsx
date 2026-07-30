'use client';

// BuilderContext: manages in-progress builder documents.
// Documents are held in React state. saveDocument() persists to Firestore.
// Dirty tracking compares current state to last-saved snapshot.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import type { CompositionEnvelope } from './types';
import type { BuilderDocument, BuilderTile, DocumentType } from './builder-types';
import { envelopeToTile } from './builder-types';
import { saveBuilderDocument, getBuilderDocuments } from './builder-persistence';
import { useAuth } from './auth-context';

interface BuilderContextValue {
  // Document lifecycle
  createDocument: (type: DocumentType, name: string, firstEnvelope: CompositionEnvelope) => string;
  saveDocument: (docId: string) => Promise<void>;
  discardDocument: (docId: string) => void;
  loadDocument: (doc: BuilderDocument) => void;

  // Tile operations
  addTile: (docId: string, envelope: CompositionEnvelope) => void;
  removeTile: (docId: string, tileId: string) => void;
  updateTile: (docId: string, tileId: string, updates: Partial<BuilderTile>) => void;

  // Document metadata
  renameDocument: (docId: string, name: string) => void;

  // Queries
  getDocument: (docId: string) => BuilderDocument | undefined;
  getOpenDocuments: () => BuilderDocument[];
  hasUnsavedChanges: (docId: string) => boolean;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

/** Find the next available row in the grid for a new tile. */
function findNextRow(tiles: BuilderTile[]): number {
  if (tiles.length === 0) return 0;
  let maxBottom = 0;
  for (const t of tiles) {
    const bottom = t.row + t.rowSpan;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom;
}

/** Find a position for a new tile: tries to fit beside existing tiles, else adds a new row. */
function findNextPosition(tiles: BuilderTile[]): { col: number; row: number } {
  if (tiles.length === 0) return { col: 0, row: 0 };

  // Find the last tile (by row, then col)
  const sorted = [...tiles].sort((a, b) => a.row - b.row || a.col - b.col);
  const last = sorted[sorted.length - 1];

  // Try to place beside the last tile on the same row
  const nextCol = last.col + last.colSpan;
  if (nextCol + 6 <= 12) {
    return { col: nextCol, row: last.row };
  }

  // New row
  return { col: 0, row: findNextRow(tiles) };
}

function generateId(): string {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function BuilderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<BuilderDocument[]>([]);
  // Snapshots of the last-saved state, keyed by document ID
  const savedSnapshots = useRef<Map<string, string>>(new Map());

  const getDocument = useCallback(
    (docId: string) => documents.find((d) => d.id === docId),
    [documents],
  );

  const getOpenDocuments = useCallback(() => documents, [documents]);

  const hasUnsavedChanges = useCallback(
    (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return false;
      const snapshot = savedSnapshots.current.get(docId);
      if (!snapshot) return true; // never saved
      return JSON.stringify(doc) !== snapshot;
    },
    [documents],
  );

  const createDocument = useCallback(
    (type: DocumentType, name: string, firstEnvelope: CompositionEnvelope): string => {
      const id = generateId();
      const now = new Date().toISOString();
      const { col, row } = findNextPosition([]);
      const tile = envelopeToTile(firstEnvelope, col, row);

      const newDoc: BuilderDocument = {
        id,
        userId: user?.uid ?? '',
        type,
        name,
        description: '',
        tiles: [tile],
        createdAt: now,
        updatedAt: now,
        tags: [],
      };
      setDocuments((prev) => [...prev, newDoc]);
      return id;
    },
    [user?.uid],
  );

  const loadDocument = useCallback((doc: BuilderDocument) => {
    setDocuments((prev) => {
      const exists = prev.find((d) => d.id === doc.id);
      if (exists) return prev;
      return [...prev, doc];
    });
    // Mark as "saved" since it came from Firestore
    savedSnapshots.current.set(doc.id, JSON.stringify(doc));
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    getBuilderDocuments(user.uid)
      .then((docs) => {
        for (const doc of docs) {
          loadDocument(doc);
        }
      })
      .catch((err) => console.error('Failed to load builder documents:', err));
  }, [user?.uid, loadDocument]);

  const saveDocument = useCallback(
    async (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc || !user?.uid) return;
      const updated = { ...doc, updatedAt: new Date().toISOString(), userId: user.uid };
      setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
      await saveBuilderDocument(user.uid, updated);
      savedSnapshots.current.set(docId, JSON.stringify(updated));
    },
    [documents, user?.uid],
  );

  const discardDocument = useCallback((docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    savedSnapshots.current.delete(docId);
  }, []);

  const addTile = useCallback(
    (docId: string, envelope: CompositionEnvelope) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const pos = findNextPosition(d.tiles);
          const tile = envelopeToTile(envelope, pos.col, pos.row);
          return { ...d, tiles: [...d.tiles, tile], updatedAt: new Date().toISOString() };
        }),
      );
    },
    [],
  );

  const removeTile = useCallback((docId: string, tileId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        return { ...d, tiles: d.tiles.filter((t) => t.id !== tileId), updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const updateTile = useCallback((docId: string, tileId: string, updates: Partial<BuilderTile>) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        return {
          ...d,
          tiles: d.tiles.map((t) => (t.id === tileId ? { ...t, ...updates } : t)),
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const renameDocument = useCallback((docId: string, name: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, name, updatedAt: new Date().toISOString() } : d)),
    );
  }, []);

  return (
    <BuilderContext.Provider
      value={{
        createDocument,
        saveDocument,
        discardDocument,
        loadDocument,
        addTile,
        removeTile,
        updateTile,
        renameDocument,
        getDocument,
        getOpenDocuments,
        hasUnsavedChanges,
      }}
    >
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder() {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder must be used inside BuilderProvider');
  return ctx;
}
