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
import type {
  BuilderDocument,
  BuilderTile,
  DocumentType,
  AppFilterControl,
  TileInteractionRule,
} from './builder-types';
import { envelopeToTile, groupTilesIntoRows, computeEqualizedSpans, equalizeRowTiles } from './builder-types';
export { groupTilesIntoRows, computeEqualizedSpans, equalizeRowTiles } from './builder-types';
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
  moveTileToRow: (docId: string, tileId: string, targetRowIndex: number, targetTileIndex: number, createNewRow?: boolean) => void;
  reorderTiles: (docId: string, tiles: BuilderTile[]) => void;

  // Layout & Row operations
  setTileWidthPercent: (docId: string, tileId: string, widthPercent: number, adjacentTileId?: string, adjacentWidthPercent?: number) => void;
  equalizeRowWidths: (docId: string, targetTileId: string) => void;
  equalizeAllRows: (docId: string) => void;
  setRowHeight: (docId: string, targetTileIdOrRowIdx: string | number, heightOrSpan: number) => void;
  applyRowPreset: (docId: string, targetTileId: string, presetSpans: number[]) => void;
  setDocumentDensity: (docId: string, density: 'compact' | 'standard' | 'spacious') => void;

  // Filter operations
  addFilter: (docId: string, filter: AppFilterControl) => void;
  removeFilter: (docId: string, filterId: string) => void;
  updateFilter: (docId: string, filterId: string, updates: Partial<AppFilterControl>) => void;
  setFilterValue: (docId: string, paramName: string, value: unknown) => void;
  clearFilters: (docId: string) => void;

  // Interaction & Cross-Filter operations
  addInteractionRule: (docId: string, rule: TileInteractionRule) => void;
  removeInteractionRule: (docId: string, ruleId: string) => void;
  setActiveSelection: (docId: string, dimension: string, value: unknown, sourceTileId?: string, project?: string) => Promise<void>;
  clearActiveSelections: (docId: string, project?: string) => Promise<void>;

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
        interactions: [],
        activeSelections: {},
        createdAt: now,
        updatedAt: now,
        tags: [],
      };
      setDocuments((prev) => [...prev, newDoc]);
      globalActiveDocIdRef = id;
      if (user?.uid) {
        saveBuilderDocument(user.uid, newDoc).catch((err) =>
          console.warn('[builder-context] Auto-save on create failed:', err),
        );
      }
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
        interactions: [],
        activeSelections: {},
        createdAt: now,
        updatedAt: now,
        tags: [],
      };
      setDocuments((prev) => [...prev, newDoc]);
      globalActiveDocIdRef = id;
      if (user?.uid) {
        saveBuilderDocument(user.uid, newDoc).catch((err) =>
          console.warn('[builder-context] Auto-save on create failed:', err),
        );
      }
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
          const rows = groupTilesIntoRows(d.tiles);
          const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;

          const newTile = envelopeToTile(envelope, 0, rows.length);
          newTile.rowHeight = lastRow?.[0]?.rowHeight || 220;

          let nextRows: BuilderTile[][];
          if (!lastRow || lastRow.length >= 3) {
            nextRows = [...rows, equalizeRowTiles([newTile], rows.length)];
          } else {
            const updatedLastRow = equalizeRowTiles([...lastRow, newTile], rows.length - 1);
            nextRows = [...rows.slice(0, rows.length - 1), updatedLastRow];
          }

          const flattenedTiles: BuilderTile[] = [];
          nextRows.forEach((row, rIdx) => {
            row.forEach((tile, cIdx) => {
              flattenedTiles.push({
                ...tile,
                row: rIdx,
                rowIndex: rIdx,
                col: cIdx,
              });
            });
          });

          return { ...d, tiles: flattenedTiles, updatedAt: new Date().toISOString() };
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
          const rows = groupTilesIntoRows(d.tiles);
          const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;

          const tile: BuilderTile = {
            id: `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            title: partialTile.title || 'New Tile',
            col: 0,
            row: rows.length,
            rowIndex: rows.length,
            colSpan: partialTile.colSpan || 12,
            rowSpan: partialTile.rowSpan || 2,
            rowHeight: partialTile.rowHeight || lastRow?.[0]?.rowHeight || 220,
            widthPercent: 100,
            tileType: partialTile.tileType || 'query',
            vizType: partialTile.vizType || 'TABLE',
            cachedSql: partialTile.cachedSql,
            parameterizedSql: partialTile.parameterizedSql,
            textContent: partialTile.textContent,
            lastSnapshot: partialTile.lastSnapshot,
          };

          let nextRows: BuilderTile[][];
          if (!lastRow || lastRow.length >= 3) {
            nextRows = [...rows, equalizeRowTiles([tile], rows.length)];
          } else {
            const updatedLastRow = equalizeRowTiles([...lastRow, tile], rows.length - 1);
            nextRows = [...rows.slice(0, rows.length - 1), updatedLastRow];
          }

          const flattenedTiles: BuilderTile[] = [];
          nextRows.forEach((row, rIdx) => {
            row.forEach((t, cIdx) => {
              flattenedTiles.push({
                ...t,
                row: rIdx,
                rowIndex: rIdx,
                col: cIdx,
              });
            });
          });

          return { ...d, tiles: flattenedTiles, updatedAt: new Date().toISOString() };
        }),
      );
    },
    [],
  );

  const removeTile = useCallback((docId: string, tileId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const currentRows = groupTilesIntoRows(d.tiles);
        const nextRows = currentRows
          .map((row, rIdx) => {
            const filtered = row.filter((t) => t.id !== tileId);
            return filtered.length > 0 ? equalizeRowTiles(filtered, rIdx) : [];
          })
          .filter((row) => row.length > 0);

        const flattenedTiles: BuilderTile[] = [];
        nextRows.forEach((row, rIdx) => {
          row.forEach((tile, cIdx) => {
            flattenedTiles.push({
              ...tile,
              row: rIdx,
              rowIndex: rIdx,
              col: cIdx,
            });
          });
        });

        return { ...d, tiles: flattenedTiles, updatedAt: new Date().toISOString() };
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
          activeSelections: {},
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  // Interaction & Cross-Filter operations
  const addInteractionRule = useCallback(
    (docId: string, rule: TileInteractionRule) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const currentRules = d.interactions || [];
          const exists = currentRules.some((r) => r.id === rule.id);
          const nextRules = exists
            ? currentRules.map((r) => (r.id === rule.id ? rule : r))
            : [...currentRules, rule];
          const updated = {
            ...d,
            interactions: nextRules,
            updatedAt: new Date().toISOString(),
          };
          if (user?.uid) {
            saveBuilderDocument(user.uid, updated).catch(() => {});
          }
          return updated;
        }),
      );
    },
    [user?.uid],
  );

  const removeInteractionRule = useCallback(
    (docId: string, ruleId: string) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const nextRules = (d.interactions || []).filter((r) => r.id !== ruleId);
          const updated = {
            ...d,
            interactions: nextRules,
            updatedAt: new Date().toISOString(),
          };
          if (user?.uid) {
            saveBuilderDocument(user.uid, updated).catch(() => {});
          }
          return updated;
        }),
      );
    },
    [user?.uid],
  );

  const setActiveSelection = useCallback(
    async (docId: string, dimension: string, value: unknown, sourceTileId?: string, project?: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;

      const currentActive = doc.activeSelections?.[dimension];
      const isToggleOff =
        currentActive && currentActive.value === value && value !== undefined && value !== null && value !== '';

      const nextSelections = { ...(doc.activeSelections || {}) };
      const nextFilterValues = { ...(doc.filterValues || {}) };

      if (isToggleOff || value === null || value === undefined || value === '') {
        delete nextSelections[dimension];
        delete nextFilterValues[dimension];
        delete nextFilterValues[dimension.toLowerCase()];
      } else {
        nextSelections[dimension] = { dimension, value, sourceTileId };
        nextFilterValues[dimension] = value;
      }

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, activeSelections: nextSelections, filterValues: nextFilterValues, updatedAt: new Date().toISOString() }
            : d,
        ),
      );

      // Re-run target tiles or all parameterized tiles if project available
      if (project) {
        const matchingRules = (doc.interactions || []).filter(
          (r) =>
            (r.dimension.toLowerCase() === dimension.toLowerCase() ||
              r.paramName.toLowerCase() === dimension.toLowerCase()) &&
            (!sourceTileId || !r.sourceTileId || r.sourceTileId === sourceTileId),
        );

        let targetTileIds: string[] = [];
        for (const rule of matchingRules) {
          if (rule.targetTileIds && rule.targetTileIds.length > 0) {
            targetTileIds.push(...rule.targetTileIds);
          } else if (rule.targetTileTitles && rule.targetTileTitles.length > 0) {
            const matched = doc.tiles
              .filter((t) =>
                rule.targetTileTitles?.some((title) => t.title.toLowerCase().includes(title.toLowerCase())),
              )
              .map((t) => t.id);
            targetTileIds.push(...matched);
          }
        }

        const tilesToRun = doc.tiles.filter((tile) => {
          if (tile.id === sourceTileId) return false;
          if (targetTileIds.length > 0) return targetTileIds.includes(tile.id);
          return (tile.cachedSql || tile.parameterizedSql) && tile.tileType !== 'text';
        });

        await Promise.allSettled(
          tilesToRun.map(async (tile) => {
            try {
              const snapshot = await executeTileQuery(tile, nextFilterValues, doc.globalFilters || [], project);
              setDocuments((prev) =>
                prev.map((d) =>
                  d.id === docId
                    ? {
                        ...d,
                        tiles: d.tiles.map((t) =>
                          t.id === tile.id ? { ...t, lastSnapshot: snapshot, artifactData: snapshot } : t,
                        ),
                      }
                    : d,
                ),
              );
            } catch (err) {
              console.warn(`[builder-context] Re-run for cross-filtered tile ${tile.id} failed:`, err);
            }
          }),
        );
      }
    },
    [documents],
  );

  const clearActiveSelections = useCallback(
    async (docId: string, project?: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;

      const activeDimensions = Object.keys(doc.activeSelections || {});
      const nextFilterValues = { ...(doc.filterValues || {}) };
      for (const dim of activeDimensions) {
        delete nextFilterValues[dim];
        delete nextFilterValues[dim.toLowerCase()];
      }

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, activeSelections: {}, filterValues: nextFilterValues, updatedAt: new Date().toISOString() }
            : d,
        ),
      );

      if (project) {
        const queryTiles = doc.tiles.filter((t) => (t.cachedSql || t.parameterizedSql) && t.tileType !== 'text');
        await Promise.allSettled(
          queryTiles.map(async (tile) => {
            try {
              const snapshot = await executeTileQuery(tile, nextFilterValues, doc.globalFilters || [], project);
              setDocuments((prev) =>
                prev.map((d) =>
                  d.id === docId
                    ? {
                        ...d,
                        tiles: d.tiles.map((t) =>
                          t.id === tile.id ? { ...t, lastSnapshot: snapshot, artifactData: snapshot } : t,
                        ),
                      }
                    : d,
                ),
              );
            } catch (err) {
              console.warn(`[builder-context] Re-run on clear selections failed for tile ${tile.id}:`, err);
            }
          }),
        );
      }
    },
    [documents],
  );

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
        const currentRows = groupTilesIntoRows(d.tiles);
        let foundSource: BuilderTile | null = null;

        const nextRows = currentRows.map((row, rIdx) => {
          const idx = row.findIndex((t) => t.id === tileId);
          if (idx === -1) return row;
          foundSource = row[idx];
          const newTile: BuilderTile = {
            ...foundSource,
            id: `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            title: `${foundSource.title} (Copy)`,
          };
          const updatedRow = [...row];
          updatedRow.splice(idx + 1, 0, newTile);
          return equalizeRowTiles(updatedRow, rIdx);
        });

        if (!foundSource) return d;

        const flattenedTiles: BuilderTile[] = [];
        nextRows.forEach((row, rIdx) => {
          row.forEach((tile, cIdx) => {
            flattenedTiles.push({
              ...tile,
              row: rIdx,
              rowIndex: rIdx,
              col: cIdx,
            });
          });
        });

        return {
          ...d,
          tiles: flattenedTiles,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const moveTile = useCallback((docId: string, tileId: string, direction: 'left' | 'right' | 'up' | 'down') => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const currentRows = groupTilesIntoRows(d.tiles);
        let sourceRowIdx = -1;
        let sourceTileIdx = -1;

        currentRows.forEach((row, rIdx) => {
          const tIdx = row.findIndex((t) => t.id === tileId);
          if (tIdx !== -1) {
            sourceRowIdx = rIdx;
            sourceTileIdx = tIdx;
          }
        });

        if (sourceRowIdx === -1 || sourceTileIdx === -1) return d;

        const currentRow = currentRows[sourceRowIdx];

        if (direction === 'left' && sourceTileIdx > 0) {
          const updated = [...currentRow];
          const temp = updated[sourceTileIdx - 1];
          updated[sourceTileIdx - 1] = updated[sourceTileIdx];
          updated[sourceTileIdx] = temp;
          currentRows[sourceRowIdx] = updated;
        } else if (direction === 'right' && sourceTileIdx < currentRow.length - 1) {
          const updated = [...currentRow];
          const temp = updated[sourceTileIdx + 1];
          updated[sourceTileIdx + 1] = updated[sourceTileIdx];
          updated[sourceTileIdx] = temp;
          currentRows[sourceRowIdx] = updated;
        } else if (direction === 'up' && sourceRowIdx > 0) {
          const [movedTile] = currentRows[sourceRowIdx].splice(sourceTileIdx, 1);
          currentRows[sourceRowIdx - 1].push(movedTile);
          currentRows[sourceRowIdx] = equalizeRowTiles(currentRows[sourceRowIdx], sourceRowIdx);
          currentRows[sourceRowIdx - 1] = equalizeRowTiles(currentRows[sourceRowIdx - 1], sourceRowIdx - 1);
        } else if (direction === 'down' && sourceRowIdx < currentRows.length - 1) {
          const [movedTile] = currentRows[sourceRowIdx].splice(sourceTileIdx, 1);
          currentRows[sourceRowIdx + 1].push(movedTile);
          currentRows[sourceRowIdx] = equalizeRowTiles(currentRows[sourceRowIdx], sourceRowIdx);
          currentRows[sourceRowIdx + 1] = equalizeRowTiles(currentRows[sourceRowIdx + 1], sourceRowIdx + 1);
        }

        const validRows = currentRows.filter((r) => r.length > 0);
        const flattenedTiles: BuilderTile[] = [];
        validRows.forEach((row, rIdx) => {
          row.forEach((tile, cIdx) => {
            flattenedTiles.push({
              ...tile,
              row: rIdx,
              rowIndex: rIdx,
              col: cIdx,
            });
          });
        });

        return { ...d, tiles: flattenedTiles, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const moveTileToRow = useCallback(
    (
      docId: string,
      tileId: string,
      targetRowIdx: number,
      targetTileIdx: number,
      createNewRow = false,
    ) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const currentRows = groupTilesIntoRows(d.tiles);
          let sourceTile: BuilderTile | null = null;

          const filteredRows = currentRows.map((row) => {
            const found = row.find((t) => t.id === tileId);
            if (found) {
              sourceTile = found;
              return row.filter((t) => t.id !== tileId);
            }
            return row;
          });

          if (!sourceTile) return d;

          const adjustedRows = filteredRows
            .map((row) => (row.length > 0 ? equalizeRowTiles(row) : []))
            .filter((row) => row.length > 0);

          const movedTile: BuilderTile = sourceTile;

          if (createNewRow) {
            const clampedTargetRow = Math.max(0, Math.min(adjustedRows.length, targetRowIdx));
            const newRow = equalizeRowTiles([{ ...movedTile, widthPercent: 100 }], clampedTargetRow);
            adjustedRows.splice(clampedTargetRow, 0, newRow);
          } else {
            const clampedTargetRow = Math.max(0, Math.min(adjustedRows.length - 1, targetRowIdx));
            if (adjustedRows.length === 0) {
              adjustedRows.push(equalizeRowTiles([{ ...movedTile, widthPercent: 100 }], 0));
            } else {
              const targetRow = [...adjustedRows[clampedTargetRow]];
              const clampedTileIdx = Math.max(0, Math.min(targetRow.length, targetTileIdx));
              targetRow.splice(clampedTileIdx, 0, movedTile);
              adjustedRows[clampedTargetRow] = equalizeRowTiles(targetRow, clampedTargetRow);
            }
          }

          const flattenedTiles: BuilderTile[] = [];
          adjustedRows.forEach((row, rIdx) => {
            row.forEach((tile, cIdx) => {
              flattenedTiles.push({
                ...tile,
                row: rIdx,
                rowIndex: rIdx,
                col: cIdx,
              });
            });
          });

          return {
            ...d,
            tiles: flattenedTiles,
            updatedAt: new Date().toISOString(),
          };
        }),
      );
    },
    [],
  );

  const setTileWidthPercent = useCallback(
    (
      docId: string,
      tileId: string,
      widthPercent: number,
      adjacentTileId?: string,
      adjacentWidthPercent?: number,
    ) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const updatedTiles = d.tiles.map((t) => {
            if (t.id === tileId) {
              return { ...t, widthPercent };
            }
            if (adjacentTileId && t.id === adjacentTileId && adjacentWidthPercent !== undefined) {
              return { ...t, widthPercent: adjacentWidthPercent };
            }
            return t;
          });
          return { ...d, tiles: updatedTiles, updatedAt: new Date().toISOString() };
        }),
      );
    },
    [],
  );

  const equalizeRowWidths = useCallback((docId: string, targetTileId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const rows = groupTilesIntoRows(d.tiles);
        const nextRows = rows.map((row, rIdx) => {
          if (row.some((t) => t.id === targetTileId)) {
            return equalizeRowTiles(row, rIdx);
          }
          return row;
        });

        const flattenedTiles: BuilderTile[] = [];
        nextRows.forEach((row, rIdx) => {
          row.forEach((tile, cIdx) => {
            flattenedTiles.push({
              ...tile,
              row: rIdx,
              rowIndex: rIdx,
              col: cIdx,
            });
          });
        });

        return { ...d, tiles: flattenedTiles, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const equalizeAllRows = useCallback((docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const rows = groupTilesIntoRows(d.tiles);
        const nextRows = rows.map((row, rIdx) => equalizeRowTiles(row, rIdx));

        const flattenedTiles: BuilderTile[] = [];
        nextRows.forEach((row, rIdx) => {
          row.forEach((tile, cIdx) => {
            flattenedTiles.push({
              ...tile,
              row: rIdx,
              rowIndex: rIdx,
              col: cIdx,
            });
          });
        });

        return { ...d, tiles: flattenedTiles, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const setRowHeight = useCallback(
    (docId: string, targetTileIdOrRowIdx: string | number, heightOrSpan: number) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const rows = groupTilesIntoRows(d.tiles);
          let targetRow: BuilderTile[] | undefined;

          if (typeof targetTileIdOrRowIdx === 'number') {
            targetRow = rows[targetTileIdOrRowIdx];
          } else {
            targetRow = rows.find((r) => r.some((t) => t.id === targetTileIdOrRowIdx));
          }
          if (!targetRow || targetRow.length === 0) return d;

          const rowIds = new Set(targetRow.map((t) => t.id));
          const isPixelHeight = heightOrSpan > 20;
          const pixelHeight = isPixelHeight ? heightOrSpan : heightOrSpan * 110;
          const rowSpan = isPixelHeight ? Math.max(1, Math.round(heightOrSpan / 110)) : heightOrSpan;

          const updatedTiles = d.tiles.map((t) =>
            rowIds.has(t.id) ? { ...t, rowHeight: pixelHeight, rowSpan } : t,
          );

          return { ...d, tiles: updatedTiles, updatedAt: new Date().toISOString() };
        }),
      );
    },
    [],
  );

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
        moveTileToRow,
        reorderTiles,
        setTileWidthPercent,
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
        addInteractionRule,
        removeInteractionRule,
        setActiveSelection,
        clearActiveSelections,
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

