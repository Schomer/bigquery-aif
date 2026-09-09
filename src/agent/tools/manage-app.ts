// src/agent/tools/manage-app.ts
// Tool: manage_app
// Creates, modifies, inspects, and manages interactive dashboards and data applications.

import type { ToolDef, ToolResult } from './types';
import type { BuilderDocument, BuilderTile, DocumentType, AppFilterControl, FilterControlType } from '../../lib/builder-types';
import {
  getGlobalBuilderDocuments,
  getGlobalActiveDocument,
  setGlobalBuilderDocuments,
} from '../../lib/builder-context';
import { executeQuery } from '../../lib/bigquery-client';
import { auth } from '../../lib/firebase';
import { saveBuilderDocument, deleteBuilderDocument, getBuilderDocuments } from '../../lib/builder-persistence';
import { saveDocumentToBigQuery, fetchFilterOptionsFromBigQuery } from '../../lib/app-executor';

function generateId(prefix = 'doc'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const manageAppTool: ToolDef = {
  declaration: {
    name: 'manage_app',
    description:
      'Create, modify, inspect, or manage interactive data apps and dashboards. ' +
      'Use action="CREATE" to create a new dashboard or interactive data app with custom tiles, charts, and filter controls. ' +
      'Use action="ADD_TILE" to add a new query, chart, or text tile to an active or specified dashboard. ' +
      'Use action="ADD_FILTER" to add interactive filter controls (like Country, Date Range, Category) bound to SQL parameters. ' +
      'Use action="UPDATE_TILE" to modify a tile\'s chart type, SQL query, or dimensions. ' +
      'Use action="EXPORT_BIGQUERY" to save the app/dashboard definition directly to BigQuery metadata table. ' +
      'Use action="LIST" to list existing dashboards and apps.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: 'The app management action to perform.',
          enum: ['CREATE', 'ADD_TILE', 'ADD_FILTER', 'UPDATE_TILE', 'UPDATE_LAYOUT', 'LIST', 'DELETE', 'EXPORT_BIGQUERY'],
        },
        document_id: {
          type: 'STRING',
          description: 'Target document ID. If omitted, defaults to the most active dashboard or newly created document.',
        },
        document_name: {
          type: 'STRING',
          description: 'Title of the dashboard or app (e.g. "Sales & Revenue Performance", "Customer Analytics App").',
        },
        document_type: {
          type: 'STRING',
          description: 'Type of data artifact.',
          enum: ['dashboard', 'app', 'report', 'recipe'],
        },
        description: {
          type: 'STRING',
          description: 'Short description of what this dashboard or app displays.',
        },
        tiles: {
          type: 'ARRAY',
          description: 'Tiles to create or add.',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', description: 'Headline / title of the tile' },
              sql: { type: 'STRING', description: 'SQL query for this tile (can use {{param}} or {{start_date}} placeholders)' },
              viz_type: {
                type: 'STRING',
                description: 'Visualization type for this tile',
                enum: [
                  'TABLE', 'KPI_CARD', 'STAT_ROW', 'BAR_CHART', 'COLUMN_CHART',
                  'LINE_CHART', 'AREA_CHART', 'PIE_CHART', 'DONUT_CHART',
                  'SCATTER', 'HISTOGRAM', 'USA_MAP', 'WORLD_MAP', 'GEO_POINT_MAP', 'TREEMAP',
                ],
              },
              col_span: { type: 'INTEGER', description: 'Width in 12-column grid (3, 4, 6, 8, 12). Default 6.' },
              row_span: { type: 'INTEGER', description: 'Height in rows (1, 2, 3, 4). Default 2.' },
              text_content: { type: 'STRING', description: 'Markdown / text content for text tiles' },
            },
            required: ['title'],
          },
        },
        filters: {
          type: 'ARRAY',
          description: 'Interactive global filters to attach to the dashboard/app.',
          items: {
            type: 'OBJECT',
            properties: {
              label: { type: 'STRING', description: 'Human-readable filter label (e.g. "Country", "Date Range", "Category")' },
              param_name: { type: 'STRING', description: 'Parameter placeholder used in SQL queries (e.g. "country", "start_date")' },
              type: {
                type: 'STRING',
                description: 'Filter UI component type',
                enum: ['DROPDOWN', 'MULTI_SELECT', 'DATE_RANGE', 'SEARCH_INPUT', 'NUMBER_INPUT'],
              },
              default_value: { type: 'STRING', description: 'Default pre-selected value' },
              options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Static option list' },
              options_sql: { type: 'STRING', description: 'BigQuery SQL query to fetch options dynamically' },
            },
            required: ['label', 'param_name', 'type'],
          },
        },
        tile_id: {
          type: 'STRING',
          description: 'Specific tile ID to update or remove.',
        },
        export_dataset: {
          type: 'STRING',
          description: 'Dataset name for saving setup to BigQuery (default: "_metadata").',
        },
      },
      required: ['action'],
    },
  },
  tier: 'reversible',

  execute: async (args, project): Promise<ToolResult> => {
    const action = String(args.action || 'LIST').toUpperCase();
    let openDocs = [...getGlobalBuilderDocuments()];

    try {
      // ── 1. LIST ─────────────────────────────────────────────────────────────
      if (action === 'LIST') {
        return {
          data: {
            action: 'LIST',
            count: openDocs.length,
            documents: openDocs.map((d) => ({
              id: d.id,
              name: d.name,
              type: d.type,
              tileCount: d.tiles.length,
              tiles: d.tiles.map((t) => ({ id: t.id, title: t.title, vizType: t.vizType })),
              filters: d.globalFilters?.map((f) => ({ label: f.label, param: f.paramName, type: f.type })),
            })),
          },
        };
      }

      // ── 2. CREATE ───────────────────────────────────────────────────────────
      if (action === 'CREATE') {
        const name = (args.document_name as string) || 'New Data App';
        const docType = (args.document_type as DocumentType) || 'dashboard';
        const description = (args.description as string) || '';
        const docId = generateId('doc');
        const now = new Date().toISOString();

        // Process filters
        const rawFilters = (args.filters as any[]) || [];
        const globalFilters: AppFilterControl[] = [];
        for (const rf of rawFilters) {
          let options = rf.options || [];
          if (rf.options_sql && project) {
            try {
              options = await fetchFilterOptionsFromBigQuery(rf.options_sql, project);
            } catch { /* ignore */ }
          }
          globalFilters.push({
            id: generateId('filter'),
            label: rf.label,
            paramName: rf.param_name || rf.label.toLowerCase().replace(/\s+/g, '_'),
            type: (rf.type as FilterControlType) || 'DROPDOWN',
            defaultValue: rf.default_value ?? null,
            options,
            optionsSql: rf.options_sql,
          });
        }

        // Process initial tiles
        const rawTiles = (args.tiles as any[]) || [];
        const tiles: BuilderTile[] = [];
        let currentRow = 0;

        for (let i = 0; i < rawTiles.length; i++) {
          const rt = rawTiles[i];
          const colSpan = rt.col_span || 6;
          const rowSpan = rt.row_span || 2;
          const tileId = generateId('tile');
          const sql = rt.sql || '';
          let snapshot: any = undefined;

          // Run initial query if SQL provided and project is active
          if (sql && project && !rt.text_content) {
            try {
              // Substitute default start/end dates if template has them
              const cleanSql = sql
                .replace(/\{\{start_date\}\}/g, '1900-01-01')
                .replace(/\{\{end_date\}\}/g, '2100-12-31');
              const res = await executeQuery(cleanSql, project);
              snapshot = {
                columns: res.columns,
                rows: res.rows,
                rowCount: res.rowCount,
                fetchedAt: now,
              };
            } catch (err) {
              console.warn(`[manage_app] Initial query for tile "${rt.title}" failed:`, err);
            }
          }

          tiles.push({
            id: tileId,
            title: rt.title || `Tile ${i + 1}`,
            col: (i % 2) * 6,
            row: currentRow,
            colSpan,
            rowSpan,
            tileType: rt.text_content ? 'text' : 'query',
            textContent: rt.text_content,
            cachedSql: sql || undefined,
            parameterizedSql: sql.includes('{{') ? sql : undefined,
            vizType: (rt.viz_type as any) || 'TABLE',
            artifactData: snapshot,
            lastSnapshot: snapshot,
          });

          if (i % 2 === 1 || colSpan === 12) {
            currentRow += rowSpan;
          }
        }

        const uid = auth.currentUser?.uid || '';
        const newDoc: BuilderDocument = {
          id: docId,
          userId: uid,
          type: docType,
          name,
          description,
          tiles,
          globalFilters,
          filterValues: {},
          project: project || undefined,
          createdAt: now,
          updatedAt: now,
          tags: [],
        };

        openDocs = [newDoc, ...openDocs];
        setGlobalBuilderDocuments(openDocs);

        if (uid) {
          try {
            await saveBuilderDocument(uid, newDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving document to Firestore:', e);
          }
        }

        return {
          data: {
            action: 'CREATE',
            document_id: docId,
            name,
            type: docType,
            description,
            tile_count: tiles.length,
            tile_names: tiles.map((t) => t.title),
            filter_count: globalFilters.length,
            filters: globalFilters.map((f) => ({ label: f.label, param: f.paramName, type: f.type })),
          },
        };
      }

      // ── 3. ADD_TILE ─────────────────────────────────────────────────────────
      if (action === 'ADD_TILE') {
        const targetId = (args.document_id as string) || openDocs[0]?.id;
        let targetDoc = openDocs.find((d) => d.id === targetId);

        if (!targetDoc) {
          // If no doc exists yet, auto-create one
          const createdId = generateId('doc');
          targetDoc = {
            id: createdId,
            userId: '',
            type: 'dashboard',
            name: (args.document_name as string) || 'Dashboard',
            description: '',
            tiles: [],
            globalFilters: [],
            filterValues: {},
            project: project || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: [],
          };
          openDocs.unshift(targetDoc);
        }

        const rawTiles = (args.tiles as any[]) || [
          {
            title: (args.document_name as string) || 'New Query Tile',
            sql: '',
            viz_type: 'TABLE',
            col_span: 6,
            row_span: 2,
          },
        ];

        const addedTiles: BuilderTile[] = [];
        const nextRow = targetDoc.tiles.reduce((max, t) => Math.max(max, t.row + t.rowSpan), 0);

        for (let i = 0; i < rawTiles.length; i++) {
          const rt = rawTiles[i];
          const tileId = generateId('tile');
          const sql = rt.sql || '';
          let snapshot: any = undefined;

          if (sql && project && !rt.text_content) {
            try {
              const cleanSql = sql
                .replace(/\{\{start_date\}\}/g, '1900-01-01')
                .replace(/\{\{end_date\}\}/g, '2100-12-31');
              const res = await executeQuery(cleanSql, project);
              snapshot = {
                columns: res.columns,
                rows: res.rows,
                rowCount: res.rowCount,
                fetchedAt: new Date().toISOString(),
              };
            } catch (err) {
              console.warn(`[manage_app] Query for new tile failed:`, err);
            }
          }

          const newTile: BuilderTile = {
            id: tileId,
            title: rt.title || `Tile ${targetDoc.tiles.length + i + 1}`,
            col: 0,
            row: nextRow + i * (rt.row_span || 2),
            colSpan: rt.col_span || 6,
            rowSpan: rt.row_span || 2,
            tileType: rt.text_content ? 'text' : 'query',
            textContent: rt.text_content,
            cachedSql: sql || undefined,
            parameterizedSql: sql.includes('{{') ? sql : undefined,
            vizType: (rt.viz_type as any) || 'TABLE',
            artifactData: snapshot,
            lastSnapshot: snapshot,
          };
          addedTiles.push(newTile);
        }

        targetDoc.tiles.push(...addedTiles);
        targetDoc.updatedAt = new Date().toISOString();
        setGlobalBuilderDocuments(openDocs);

        const uidAddTile = auth.currentUser?.uid || '';
        if (uidAddTile) {
          try {
            await saveBuilderDocument(uidAddTile, targetDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving updated document:', e);
          }
        }

        return {
          data: {
            action: 'ADD_TILE',
            document_id: targetDoc.id,
            name: targetDoc.name,
            added_count: addedTiles.length,
            tiles: targetDoc.tiles.map((t) => ({ id: t.id, title: t.title, vizType: t.vizType })),
          },
        };
      }

      // ── 4. ADD_FILTER ───────────────────────────────────────────────────────
      if (action === 'ADD_FILTER') {
        const targetId = (args.document_id as string) || openDocs[0]?.id;
        const targetDoc = openDocs.find((d) => d.id === targetId);
        if (!targetDoc) {
          return { data: { error: 'No active dashboard found to add filter to.' } };
        }

        const rawFilters = (args.filters as any[]) || [];
        const addedFilters: AppFilterControl[] = [];

        for (const rf of rawFilters) {
          let options = rf.options || [];
          if (rf.options_sql && project) {
            try {
              options = await fetchFilterOptionsFromBigQuery(rf.options_sql, project);
            } catch { /* ignore */ }
          }
          const filter: AppFilterControl = {
            id: generateId('filter'),
            label: rf.label,
            paramName: rf.param_name || rf.label.toLowerCase().replace(/\s+/g, '_'),
            type: (rf.type as FilterControlType) || 'DROPDOWN',
            defaultValue: rf.default_value ?? null,
            options,
            optionsSql: rf.options_sql,
          };
          targetDoc.globalFilters = targetDoc.globalFilters || [];
          targetDoc.globalFilters.push(filter);
          addedFilters.push(filter);
        }

        targetDoc.updatedAt = new Date().toISOString();
        setGlobalBuilderDocuments(openDocs);

        const uidAddFilter = auth.currentUser?.uid || '';
        if (uidAddFilter) {
          try {
            await saveBuilderDocument(uidAddFilter, targetDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving filter to document:', e);
          }
        }

        return {
          data: {
            action: 'ADD_FILTER',
            document_id: targetDoc.id,
            name: targetDoc.name,
            filters: (targetDoc.globalFilters || []).map((f) => ({ label: f.label, param: f.paramName, type: f.type })),
          },
        };
      }

      // ── 5. EXPORT_BIGQUERY ──────────────────────────────────────────────────
      if (action === 'EXPORT_BIGQUERY') {
        const targetId = (args.document_id as string) || openDocs[0]?.id;
        const targetDoc = openDocs.find((d) => d.id === targetId);
        if (!targetDoc) {
          return { data: { error: 'No dashboard found to export to BigQuery.' } };
        }
        if (!project) {
          return { data: { error: 'Google Cloud Project is required for BigQuery export.' } };
        }

        const datasetName = (args.export_dataset as string) || '_metadata';
        const exportRes = await saveDocumentToBigQuery(targetDoc, project, datasetName);

        return {
          data: {
            action: 'EXPORT_BIGQUERY',
            document_id: targetDoc.id,
            name: targetDoc.name,
            table: exportRes.table,
            message: exportRes.message,
          },
        };
      }

      // ── 6. DELETE ───────────────────────────────────────────────────────────
      if (action === 'DELETE') {
        const targetDocId = (args.document_id as string) || openDocs[0]?.id;
        const tileId = args.tile_id as string;
        const uidDel = auth.currentUser?.uid || '';

        if (tileId && targetDocId) {
          const doc = openDocs.find((d) => d.id === targetDocId);
          if (doc) {
            doc.tiles = doc.tiles.filter((t) => t.id !== tileId);
            setGlobalBuilderDocuments(openDocs);
            if (uidDel) {
              try { await saveBuilderDocument(uidDel, doc); } catch {}
            }
            return { data: { action: 'DELETE', deleted_tile: tileId, document_id: targetDocId } };
          }
        } else if (targetDocId) {
          openDocs = openDocs.filter((d) => d.id !== targetDocId);
          setGlobalBuilderDocuments(openDocs);
          if (uidDel) {
            try { await deleteBuilderDocument(uidDel, targetDocId); } catch {}
          }
          return { data: { action: 'DELETE', deleted_document: targetDocId } };
        }
      }

      return { data: { error: `Unsupported action: ${action}` } };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: { error: msg }, error: msg };
    }
  },
};
