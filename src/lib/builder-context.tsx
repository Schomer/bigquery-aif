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
import type { BuilderDocument, BuilderTile, DocumentType, AppFilterControl } from './builder-types';
import { envelopeToTile, groupTilesIntoRows, computeEqualizedSpans } from './builder-types';
export { groupTilesIntoRows, computeEqualizedSpans } from './builder-types';
import { saveBuilderDocument, getBuilderDocuments } from './builder-persistence';
import { executeTileQuery, saveDocumentToBigQuery } from './app-executor';
import { useAuth } from './auth-context';

// Global document cache accessible by agent tools
let globalDocumentsRef: BuilderDocument[] = [];
let globalActiveDocIdRef: string | null = null;
let globalSetDocumentsCallback: ((docs: BuilderDocument[]) => void) | null = null;

export function getGlobalBuilderDocuments(): BuilderDocument[] {
  return globalDocumentsRef;
}

export function getGlobalActiveDocument(): BuilderDocument | undefined {
  if (globalActiveDocIdRef) {
    const found = globalDocumentsRef.find((d) => d.id === globalActiveDocIdRef);
    if (found) return found;
  }
  return globalDocumentsRef[0];
}

export function setGlobalBuilderDocuments(docs: BuilderDocument[]) {
  globalDocumentsRef = docs;
  if (globalSetDocumentsCallback) {
    globalSetDocumentsCallback(docs);
  }
}

interface BuilderContextValue {
  // Document lifecycle
  createDocument: (type: DocumentType, name: string, firstEnvelope?: CompositionEnvelope) => string;
  createDocumentDirect: (type: DocumentType, name: string, description?: string, initialTiles?: BuilderTile[], initialFilters?: AppFilterControl[]) => string;
  saveDocument: (docId: string) => Promise<void>;
  discardDocument: (docId: string) => void;
  loadDocument: (doc: BuilderDocument) => void;

  // Tile operations
  addTile: (docId: string, envelope: CompositionEnvelope) => void;
  addCustomTile: (docId: string, tile: Partial<BuilderTile>) => void;
  removeTile: (docId: string, tileId: string) => void;
  updateTile: (docId: string, tileId: string, updates: Partial<BuilderTile>) => void;
  duplicateTile: (docId: string, tileId: string) => void;
  moveTile: (docId: string, tileId: string, direction: 'left' | 'right' | 'up' | 'down') => void;
  reorderTiles: (docId: string, tiles: BuilderTile[]) => void;

  // Layout & Row operations
  equalizeRowWidths: (docId: string, targetTileId: string) => void;
  equalizeAllRows: (docId: string) => void;
  setRowHeight: (docId: string, targetTileId: string, rowSpan: number) => void;
  applyRowPreset: (docId: string, targetTileId: string, presetSpans: number[]) => void;
  setDocumentDensity: (docId: string, density: 'compact' | 'standard' | 'spacious') => void;

  // Filter operations
  addFilter: (docId: string, filter: AppFilterControl) => void;
  removeFilter: (docId: string, filterId: string) => void;
  updateFilter: (docId: string, filterId: string, updates: Partial<AppFilterControl>) => void;
  setFilterValue: (docId: string, paramName: string, value: unknown) => void;
  clearFilters: (docId: string) => void;

  // Reactive execution
  reRunTile: (docId: string, tileId: string, project: string) => Promise<void>;
  reRunAllTiles: (docId: string, project: string) => Promise<void>;

  // BigQuery persistence
  saveToBigQuery: (docId: string, project: string, datasetName?: string) => Promise<{ success: boolean; table: string; message: string }>;

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

  const sorted = [...tiles].sort((a, b) => a.row - b.row || a.col - b.col);
  const last = sorted[sorted.length - 1];

  const nextCol = last.col + last.colSpan;
  if (nextCol + 6 <= 12) {
    return { col: nextCol, row: last.row };
  }

  return { col: 0, row: findNextRow(tiles) };
}

function generateId(): string {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function BuilderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<BuilderDocument[]>([]);
  const savedSnapshots = useRef<Map<string, string>>(new Map());

  // Keep global references updated
  useEffect(() => {
    globalDocumentsRef = documents;
    globalSetDocumentsCallback = setDocuments;
  }, [documents]);

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
      if (!snapshot) return true;
      return JSON.stringify(doc) !== snapshot;
    },
    [documents],
  );

  const createDocument = useCallback(
    (type: DocumentType, name: string, firstEnvelope?: CompositionEnvelope): string => {
      const id = generateId();
      const now = new Date().toISOString();
      let tiles: BuilderTile[] = [];
      if (firstEnvelope) {
        const { col, row } = findNextPosition([]);
        tiles = [envelopeToTile(firstEnvelope, col, row)];
      }

      const newDoc: BuilderDocument = {
        id,
        userId: user?.uid ?? '',
        type,
        name,
        description: '',
        tiles,
        globalFilters: [],
        filterValues: {},
        createdAt: now,
        updatedAt: now,
        tags: [],
      };
      setDocuments((prev) => [...prev, newDoc]);
      globalActiveDocIdRef = id;
      return id;
    },
    [user?.uid],
  );

  const createDocumentDirect = useCallback(
    (type: DocumentType, name: string, description = '', initialTiles: BuilderTile[] = [], initialFilters: AppFilterControl[] = []): string => {
      const id = generateId();
      const now = new Date().toISOString();
      const newDoc: BuilderDocument = {
        id,
        userId: user?.uid ?? '',
        type,
        name,
        description,
        tiles: initialTiles,
        globalFilters: initialFilters,
        filterValues: {},
        createdAt: now,
        updatedAt: now,
        tags: [],
      };
      setDocuments((prev) => [...prev, newDoc]);
      globalActiveDocIdRef = id;
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
      if (!doc) throw new Error('Document not found');
      if (!user?.uid) throw new Error('Please sign in to save documents.');
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

  const addCustomTile = useCallback(
    (docId: string, partialTile: Partial<BuilderTile>) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const pos = findNextPosition(d.tiles);
          const tile: BuilderTile = {
            id: `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            title: partialTile.title || 'New Tile',
            col: pos.col,
            row: pos.row,
            colSpan: partialTile.colSpan || 6,
            rowSpan: partialTile.rowSpan || 2,
            tileType: partialTile.tileType || 'query',
            vizType: partialTile.vizType || 'TABLE',
            cachedSql: partialTile.cachedSql,
            parameterizedSql: partialTile.parameterizedSql,
            textContent: partialTile.textContent,
            lastSnapshot: partialTile.lastSnapshot,
          };
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

  const reorderTiles = useCallback((docId: string, tiles: BuilderTile[]) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, tiles, updatedAt: new Date().toISOString() } : d)),
    );
  }, []);

  // Filter management
  const addFilter = useCallback((docId: string, filter: AppFilterControl) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const currentFilters = d.globalFilters || [];
        const exists = currentFilters.some((f) => f.id === filter.id || f.paramName === filter.paramName);
        if (exists) return d;
        return {
          ...d,
          globalFilters: [...currentFilters, filter],
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const removeFilter = useCallback((docId: string, filterId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const currentFilters = d.globalFilters || [];
        const nextFilters = currentFilters.filter((f) => f.id !== filterId);
        const nextValues = { ...(d.filterValues || {}) };
        delete nextValues[filterId];
        return {
          ...d,
          globalFilters: nextFilters,
          filterValues: nextValues,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const updateFilter = useCallback((docId: string, filterId: string, updates: Partial<AppFilterControl>) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const currentFilters = d.globalFilters || [];
        return {
          ...d,
          globalFilters: currentFilters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const setFilterValue = useCallback((docId: string, paramName: string, value: unknown) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        return {
          ...d,
          filterValues: { ...(d.filterValues || {}), [paramName]: value },
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const clearFilters = useCallback((docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        return {
          ...d,
          filterValues: {},
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  // Reactive re-execution
  const reRunTile = useCallback(async (docId: string, tileId: string, project: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const tile = doc.tiles.find((t) => t.id === tileId);
    if (!tile || (!tile.cachedSql && !tile.parameterizedSql) || tile.tileType === 'text') return;

    try {
      const snapshot = await executeTileQuery(tile, doc.filterValues || {}, doc.globalFilters || [], project);
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          return {
            ...d,
            tiles: d.tiles.map((t) =>
              t.id === tileId ? { ...t, lastSnapshot: snapshot, artifactData: snapshot } : t
            ),
          };
        }),
      );
    } catch (err) {
      console.error(`Failed to re-run tile ${tileId}:`, err);
      throw err;
    }
  }, [documents]);

  const reRunAllTiles = useCallback(async (docId: string, project: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc || !project) return;
    const queryTiles = doc.tiles.filter((t) => (t.cachedSql || t.parameterizedSql) && t.tileType !== 'text');

    await Promise.allSettled(
      queryTiles.map(async (tile) => {
        try {
          const snapshot = await executeTileQuery(tile, doc.filterValues || {}, doc.globalFilters || [], project);
          setDocuments((prev) =>
            prev.map((d) => {
              if (d.id !== docId) return d;
              return {
                ...d,
                tiles: d.tiles.map((t) =>
                  t.id === tile.id ? { ...t, lastSnapshot: snapshot, artifactData: snapshot } : t
                ),
              };
            }),
          );
        } catch (err) {
          console.warn(`Tile ${tile.id} re-run failed:`, err);
        }
      })
    );
  }, [documents]);

  const duplicateTile = useCallback((docId: string, tileId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const idx = d.tiles.findIndex((t) => t.id === tileId);
        if (idx === -1) return d;
        const source = d.tiles[idx];
        const newTile: BuilderTile = {
          ...source,
          id: `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          title: `${source.title} (Copy)`,
          col: Math.min(6, (source.col + source.colSpan) % 12),
          row: source.row,
        };
        const nextTiles = [...d.tiles];
        nextTiles.splice(idx + 1, 0, newTile);
        return {
          ...d,
          tiles: nextTiles,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const moveTile = useCallback((docId: string, tileId: string, direction: 'left' | 'right' | 'up' | 'down') => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const tiles = [...d.tiles];
        const idx = tiles.findIndex((t) => t.id === tileId);
        if (idx === -1) return d;

        if (direction === 'left' && idx > 0) {
          const temp = tiles[idx - 1];
          tiles[idx - 1] = tiles[idx];
          tiles[idx] = temp;
        } else if (direction === 'right' && idx < tiles.length - 1) {
          const temp = tiles[idx + 1];
          tiles[idx + 1] = tiles[idx];
          tiles[idx] = temp;
        } else if (direction === 'up') {
          const rows = groupTilesIntoRows(tiles);
          const rowIdx = rows.findIndex((r) => r.some((t) => t.id === tileId));
          if (rowIdx > 0) {
            const prevRow = rows[rowIdx - 1];
            const targetIdx = tiles.findIndex((t) => t.id === prevRow[0].id);
            const [item] = tiles.splice(idx, 1);
            tiles.splice(targetIdx, 0, item);
          }
        } else if (direction === 'down') {
          const rows = groupTilesIntoRows(tiles);
          const rowIdx = rows.findIndex((r) => r.some((t) => t.id === tileId));
          if (rowIdx < rows.length - 1 && rowIdx !== -1) {
            const nextRow = rows[rowIdx + 1];
            const targetIdx = tiles.findIndex((t) => t.id === nextRow[nextRow.length - 1].id);
            const [item] = tiles.splice(idx, 1);
            tiles.splice(targetIdx, 0, item);
          }
        }

        return { ...d, tiles, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const equalizeRowWidths = useCallback((docId: string, targetTileId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const rows = groupTilesIntoRows(d.tiles);
        const targetRow = rows.find((r) => r.some((t) => t.id === targetTileId));
        if (!targetRow || targetRow.length === 0) return d;

        const equalSpans = computeEqualizedSpans(targetRow.length);
        const updatedTiles = d.tiles.map((t) => {
          const rowPos = targetRow.findIndex((rt) => rt.id === t.id);
          if (rowPos !== -1) {
            return { ...t, colSpan: equalSpans[rowPos] };
          }
          return t;
        });

        return { ...d, tiles: updatedTiles, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const equalizeAllRows = useCallback((docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const rows = groupTilesIntoRows(d.tiles);
        const tileSpanMap = new Map<string, number>();

        for (const row of rows) {
          const equalSpans = computeEqualizedSpans(row.length);
          row.forEach((t, i) => {
            tileSpanMap.set(t.id, equalSpans[i]);
          });
        }

        const updatedTiles = d.tiles.map((t) => ({
          ...t,
          colSpan: tileSpanMap.get(t.id) ?? t.colSpan,
        }));

        return { ...d, tiles: updatedTiles, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const setRowHeight = useCallback((docId: string, targetTileId: string, rowSpan: number) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const rows = groupTilesIntoRows(d.tiles);
        const targetRow = rows.find((r) => r.some((t) => t.id === targetTileId));
        if (!targetRow) return d;

        const rowIds = new Set(targetRow.map((t) => t.id));
        const updatedTiles = d.tiles.map((t) => (rowIds.has(t.id) ? { ...t, rowSpan } : t));

        return { ...d, tiles: updatedTiles, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const applyRowPreset = useCallback((docId: string, targetTileId: string, presetSpans: number[]) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const rows = groupTilesIntoRows(d.tiles);
        const targetRow = rows.find((r) => r.some((t) => t.id === targetTileId));
        if (!targetRow) return d;

        const updatedTiles = d.tiles.map((t) => {
          const rowPos = targetRow.findIndex((rt) => rt.id === t.id);
          if (rowPos !== -1 && rowPos < presetSpans.length) {
            return { ...t, colSpan: presetSpans[rowPos] };
          }
          return t;
        });

        return { ...d, tiles: updatedTiles, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const setDocumentDensity = useCallback((docId: string, density: 'compact' | 'standard' | 'spacious') => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, density, updatedAt: new Date().toISOString() } : d)),
    );
  }, []);

  const saveToBigQuery = useCallback(async (docId: string, project: string, datasetName = '_metadata') => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) throw new Error('Document not found');
    return saveDocumentToBigQuery(doc, project, datasetName);
  }, [documents]);

  const renameDocument = useCallback((docId: string, name: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, name, updatedAt: new Date().toISOString() } : d)),
    );
  }, []);

  return (
    <BuilderContext.Provider
      value={{
        createDocument,
        createDocumentDirect,
        saveDocument,
        discardDocument,
        loadDocument,
        addTile,
        addCustomTile,
        removeTile,
        updateTile,
        duplicateTile,
        moveTile,
        reorderTiles,
        equalizeRowWidths,
        equalizeAllRows,
        setRowHeight,
        applyRowPreset,
        setDocumentDensity,
        addFilter,
        removeFilter,
        updateFilter,
        setFilterValue,
        clearFilters,
        reRunTile,
        reRunAllTiles,
        saveToBigQuery,
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

