// src/agent/tools/manage-app.ts
// Tool: manage_app
// Creates, modifies, inspects, and manages interactive dashboards and data applications.

import type { ToolDef, ToolResult } from './types';
import type {
  BuilderDocument,
  BuilderTile,
  DocumentType,
  AppFilterControl,
  FilterControlType,
  TileInteractionRule,
} from '../../lib/builder-types';
import {
  getGlobalBuilderDocuments,
  getGlobalActiveDocument,
  setGlobalBuilderDocuments,
} from '../../lib/builder-context';
import { executeQuery } from '../../lib/bigquery-client';
import { auth } from '../../lib/firebase';
import { saveBuilderDocument, deleteBuilderDocument } from '../../lib/builder-persistence';
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
      'Use action="UPDATE_TILE" to modify a tile\'s chart type, SQL query, color palette, dimensions, or title. ' +
      'Use action="SET_INTERACTION" to create cross-filtering interaction rules (e.g. "when clicking a country in the map, filter the Spending and Income charts"). ' +
      'Use action="ADD_FILTER" to add interactive filter controls (like Country, Date Range, Category, Number Range, Button Group) bound to data fields. ' +
      'Use action="UPDATE_FILTER" to update filter options, labels, or bound fields. ' +
      'Use action="DELETE_FILTER" to remove a filter control. ' +
      'Use action="UPDATE_DASHBOARD" to update dashboard title, description, or layout density. ' +
      'Use action="EXPORT_BIGQUERY" to save the app/dashboard definition directly to BigQuery metadata table. ' +
      'Use action="LIST" to list existing dashboards and apps.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: 'The app management action to perform.',
          enum: [
            'CREATE',
            'ADD_TILE',
            'UPDATE_TILE',
            'SET_INTERACTION',
            'ADD_FILTER',
            'UPDATE_FILTER',
            'DELETE_FILTER',
            'UPDATE_DASHBOARD',
            'UPDATE_LAYOUT',
            'LIST',
            'DELETE',
            'EXPORT_BIGQUERY',
          ],
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
              color_palette: { type: 'STRING', description: 'Color palette name (e.g. "emerald", "ocean", "sunset", "warm", "monochrome")' },
              col_span: { type: 'INTEGER', description: 'Width in 12-column grid (3, 4, 6, 8, 12). Default 6.' },
              row_span: { type: 'INTEGER', description: 'Height in rows (1, 2, 3, 4). Default 2.' },
              text_content: { type: 'STRING', description: 'Markdown / text content for text tiles' },
            },
            required: ['title'],
          },
        },
        tile_id: {
          type: 'STRING',
          description: 'Specific tile ID to update or remove.',
        },
        tile_title: {
          type: 'STRING',
          description: 'Target tile title/name to match if tile_id is unknown.',
        },
        viz_type: {
          type: 'STRING',
          description: 'New visualization type when updating a tile.',
          enum: [
            'TABLE', 'KPI_CARD', 'STAT_ROW', 'BAR_CHART', 'COLUMN_CHART',
            'LINE_CHART', 'AREA_CHART', 'PIE_CHART', 'DONUT_CHART',
            'SCATTER', 'HISTOGRAM', 'USA_MAP', 'WORLD_MAP', 'GEO_POINT_MAP', 'TREEMAP',
          ],
        },
        sql: {
          type: 'STRING',
          description: 'New SQL query when updating a tile.',
        },
        color_palette: {
          type: 'STRING',
          description: 'Color palette name when updating a tile.',
        },
        source_tile_id: {
          type: 'STRING',
          description: 'Source tile ID emitting the click/selection event for cross-filtering.',
        },
        source_tile_title: {
          type: 'STRING',
          description: 'Source tile name/title (e.g. "World Map", "Country Map", "Sales by Region").',
        },
        target_tile_ids: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Target tile IDs to be filtered when source tile element is clicked.',
        },
        target_tile_titles: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Target tile names/titles to be filtered (e.g. ["Spending", "Income"]).',
        },
        dimension: {
          type: 'STRING',
          description: 'Dimension/field name for cross-filtering (e.g. "country", "category", "state").',
        },
        param_name: {
          type: 'STRING',
          description: 'SQL parameter name for cross-filtering (default equals dimension).',
        },
        interaction_action: {
          type: 'STRING',
          description: 'Cross-filtering action type.',
          enum: ['filter', 'highlight'],
        },
        filters: {
          type: 'ARRAY',
          description: 'Interactive filters to attach or update on the dashboard/app.',
          items: {
            type: 'OBJECT',
            properties: {
              label: { type: 'STRING', description: 'Human-readable filter label (e.g. "Country", "Date Range", "Category")' },
              param_name: { type: 'STRING', description: 'Parameter placeholder used in SQL queries (e.g. "country", "start_date")' },
              column: { type: 'STRING', description: 'Bound data field/column name' },
              type: {
                type: 'STRING',
                description: 'Filter UI component type',
                enum: ['DROPDOWN', 'MULTI_SELECT', 'DATE_RANGE', 'DATE_PICKER', 'NUMBER_RANGE', 'SEARCH_INPUT', 'BUTTON_GROUP'],
              },
              target_tile_ids: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Specific tile IDs targeted by this filter (empty = all tiles)',
              },
              target_tile_titles: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Specific tile titles targeted by this filter',
              },
              default_value: { type: 'STRING', description: 'Default pre-selected value' },
              options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Curated static option list' },
              options_sql: { type: 'STRING', description: 'BigQuery SQL query to fetch options dynamically' },
              min: { type: 'NUMBER', description: 'Minimum numeric bound for number range' },
              max: { type: 'NUMBER', description: 'Maximum numeric bound for number range' },
            },
            required: ['label', 'type'],
          },
        },
        filter_id: {
          type: 'STRING',
          description: 'Specific filter ID to update or delete.',
        },
        density: {
          type: 'STRING',
          description: 'Layout density when updating layout.',
          enum: ['compact', 'standard', 'spacious'],
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
    const uid = auth.currentUser?.uid || '';

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
              tiles: d.tiles.map((t) => ({ id: t.id, title: t.title, vizType: t.vizType, sql: t.cachedSql || t.parameterizedSql })),
              filters: d.globalFilters?.map((f) => ({ id: f.id, label: f.label, param: f.paramName, column: f.column, type: f.type, options: f.options })),
              interactions: d.interactions?.map((i) => ({ id: i.id, dimension: i.dimension, source: i.sourceTileTitle || i.sourceTileId, targets: i.targetTileTitles || i.targetTileIds })),
            })),
          },
        };
      }

      // Helper to find target document
      const getTargetDoc = (): BuilderDocument | undefined => {
        if (args.document_id) {
          const found = openDocs.find((d) => d.id === args.document_id);
          if (found) return found;
        }
        return getGlobalActiveDocument() || openDocs[0];
      };

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
            paramName: rf.param_name || rf.label.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            column: rf.column,
            type: (rf.type as FilterControlType) || 'DROPDOWN',
            defaultValue: rf.default_value ?? null,
            options,
            optionsSql: rf.options_sql,
            min: rf.min,
            max: rf.max,
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
            colorPalette: rt.color_palette,
            artifactData: snapshot,
            lastSnapshot: snapshot,
          });

          if (i % 2 === 1 || colSpan === 12) {
            currentRow += rowSpan;
          }
        }

        const newDoc: BuilderDocument = {
          id: docId,
          userId: uid,
          type: docType,
          name,
          description,
          tiles,
          globalFilters,
          filterValues: {},
          interactions: [],
          activeSelections: {},
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
        let targetDoc = getTargetDoc();
        if (!targetDoc) {
          const createdId = generateId('doc');
          targetDoc = {
            id: createdId,
            userId: uid,
            type: 'dashboard',
            name: (args.document_name as string) || 'Dashboard',
            description: '',
            tiles: [],
            globalFilters: [],
            filterValues: {},
            interactions: [],
            activeSelections: {},
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
            sql: args.sql || '',
            viz_type: args.viz_type || 'TABLE',
            color_palette: args.color_palette,
            col_span: 6,
            row_span: 2,
          },
        ];

        const addedTiles: BuilderTile[] = [];
        const nextRow = targetDoc.tiles.reduce((max, t) => Math.max(max, t.row + t.rowSpan), 0);

        for (let i = 0; i < rawTiles.length; i++) {
          const rt = rawTiles[i];
          const tileId = generateId('tile');
          const sql = rt.sql || (args.sql as string) || '';
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
            vizType: (rt.viz_type as any) || (args.viz_type as any) || 'TABLE',
            colorPalette: rt.color_palette || (args.color_palette as string),
            artifactData: snapshot,
            lastSnapshot: snapshot,
          };
          addedTiles.push(newTile);
        }

        targetDoc.tiles.push(...addedTiles);
        targetDoc.updatedAt = new Date().toISOString();
        setGlobalBuilderDocuments(openDocs);

        if (uid) {
          try {
            await saveBuilderDocument(uid, targetDoc);
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

      // ── 4. UPDATE_TILE ──────────────────────────────────────────────────────
      if (action === 'UPDATE_TILE') {
        const targetDoc = getTargetDoc();
        if (!targetDoc) return { data: { error: 'No active dashboard found to update.' } };

        const tileId = args.tile_id as string;
        const tileTitle = args.tile_title as string;

        let targetTile = targetDoc.tiles.find((t) => t.id === tileId);
        if (!targetTile && tileTitle) {
          targetTile = targetDoc.tiles.find((t) => t.title.toLowerCase().includes(tileTitle.toLowerCase()));
        }
        if (!targetTile && targetDoc.tiles.length > 0) {
          targetTile = targetDoc.tiles[0];
        }

        if (!targetTile) {
          return { data: { error: `Could not find tile to update in dashboard "${targetDoc.name}".` } };
        }

        if (args.viz_type) targetTile.vizType = args.viz_type as any;
        if (args.color_palette) targetTile.colorPalette = args.color_palette as string;
        if (args.document_name) targetTile.title = args.document_name as string;

        if (args.sql) {
          targetTile.cachedSql = args.sql as string;
          targetTile.parameterizedSql = (args.sql as string).includes('{{') ? (args.sql as string) : undefined;
        }

        // Re-execute tile if SQL changed or project is active
        if (targetTile.cachedSql && project && targetTile.tileType !== 'text') {
          try {
            const cleanSql = targetTile.cachedSql
              .replace(/\{\{start_date\}\}/g, '1900-01-01')
              .replace(/\{\{end_date\}\}/g, '2100-12-31');
            const res = await executeQuery(cleanSql, project);
            const snapshot = {
              columns: res.columns,
              rows: res.rows,
              rowCount: res.rowCount,
              fetchedAt: new Date().toISOString(),
            };
            targetTile.lastSnapshot = snapshot;
            targetTile.artifactData = snapshot;
          } catch (err) {
            console.warn(`[manage_app] Re-query for updated tile failed:`, err);
          }
        }

        targetDoc.updatedAt = new Date().toISOString();
        setGlobalBuilderDocuments(openDocs);

        if (uid) {
          try {
            await saveBuilderDocument(uid, targetDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving updated tile:', e);
          }
        }

        return {
          data: {
            action: 'UPDATE_TILE',
            document_id: targetDoc.id,
            tile_id: targetTile.id,
            title: targetTile.title,
            viz_type: targetTile.vizType,
            color_palette: targetTile.colorPalette,
            sql: targetTile.cachedSql,
          },
        };
      }

      // ── 5. SET_INTERACTION (Cross-Filtering) ────────────────────────────────
      if (action === 'SET_INTERACTION') {
        const targetDoc = getTargetDoc();
        if (!targetDoc) return { data: { error: 'No active dashboard found.' } };

        const dim = (args.dimension as string) || (args.param_name as string) || 'country';
        const param = (args.param_name as string) || dim;

        // Match source tile
        const sourceTitle = (args.source_tile_title as string) || '';
        const sourceId = (args.source_tile_id as string) || '';
        let sourceTile = targetDoc.tiles.find((t) => t.id === sourceId);
        if (!sourceTile && sourceTitle) {
          sourceTile = targetDoc.tiles.find((t) => t.title.toLowerCase().includes(sourceTitle.toLowerCase()));
        }
        if (!sourceTile) {
          sourceTile = targetDoc.tiles.find((t) => t.vizType === 'WORLD_MAP' || t.vizType === 'USA_MAP' || t.vizType === 'GEO_POINT_MAP') || targetDoc.tiles[0];
        }

        // Match target tiles
        const targetTitles = (args.target_tile_titles as string[]) || [];
        const targetIds = (args.target_tile_ids as string[]) || [];
        const matchedTargetTiles: BuilderTile[] = [];

        for (const tile of targetDoc.tiles) {
          if (sourceTile && tile.id === sourceTile.id) continue;
          if (targetIds.includes(tile.id)) {
            matchedTargetTiles.push(tile);
            continue;
          }
          if (targetTitles.some((tt) => tile.title.toLowerCase().includes(tt.toLowerCase()))) {
            matchedTargetTiles.push(tile);
          }
        }

        const effectiveTargets = matchedTargetTiles.length > 0
          ? matchedTargetTiles
          : targetDoc.tiles.filter((t) => (!sourceTile || t.id !== sourceTile.id) && t.tileType !== 'text');

        // Parameterize target tiles' SQL queries if they don't already have {{param}}
        for (const target of effectiveTargets) {
          const baseSql = target.parameterizedSql || target.cachedSql || '';
          if (baseSql && !baseSql.includes(`{{${param}}}`) && !baseSql.includes(`@${param}`)) {
            const hasWhere = /\bWHERE\b/i.test(baseSql);
            const condition = `(${dim} = '{{${param}}}' OR '{{${param}}}' = '' OR '{{${param}}}' = 'ALL')`;

            let updatedSql = baseSql;
            const insertMatch = baseSql.match(/\b(GROUP\s+BY|ORDER\s+BY|LIMIT|QUALIFY|HAVING)\b/i);
            if (insertMatch && insertMatch.index !== undefined) {
              const before = baseSql.slice(0, insertMatch.index).trim();
              const after = baseSql.slice(insertMatch.index);
              updatedSql = hasWhere
                ? `${before} AND ${condition} ${after}`
                : `${before} WHERE ${condition} ${after}`;
            } else {
              updatedSql = hasWhere
                ? `${baseSql} AND ${condition}`
                : `${baseSql} WHERE ${condition}`;
            }

            target.parameterizedSql = updatedSql;
            target.cachedSql = updatedSql;
          }
        }

        const ruleId = generateId('rule');
        const newRule: TileInteractionRule = {
          id: ruleId,
          sourceTileId: sourceTile?.id,
          sourceTileTitle: sourceTile?.title,
          dimension: dim,
          paramName: param,
          targetTileIds: effectiveTargets.map((t) => t.id),
          targetTileTitles: effectiveTargets.map((t) => t.title),
          action: (args.interaction_action as any) || 'filter',
        };

        targetDoc.interactions = targetDoc.interactions || [];
        targetDoc.interactions = targetDoc.interactions.filter(
          (r) => !(r.sourceTileId === sourceTile?.id && r.dimension.toLowerCase() === dim.toLowerCase()),
        );
        targetDoc.interactions.push(newRule);
        targetDoc.updatedAt = new Date().toISOString();

        setGlobalBuilderDocuments(openDocs);

        if (uid) {
          try {
            await saveBuilderDocument(uid, targetDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving interaction rule:', e);
          }
        }

        return {
          data: {
            action: 'SET_INTERACTION',
            document_id: targetDoc.id,
            rule_id: ruleId,
            source_tile: sourceTile?.title || sourceTile?.id,
            target_tiles: effectiveTargets.map((t) => t.title),
            dimension: dim,
            param_name: param,
            message: `Configured cross-filtering: Clicking ${dim} in "${sourceTile?.title}" filters ${effectiveTargets.map((t) => `"${t.title}"`).join(', ')}.`,
          },
        };
      }

      // ── 6. ADD_FILTER ───────────────────────────────────────────────────────
      if (action === 'ADD_FILTER') {
        const targetDoc = getTargetDoc();
        if (!targetDoc) return { data: { error: 'No active dashboard found.' } };

        const rawFilters = (args.filters as any[]) || [];
        const addedFilters: AppFilterControl[] = [];

        for (const rf of rawFilters) {
          let options = rf.options || [];
          if (rf.options_sql && project) {
            try {
              options = await fetchFilterOptionsFromBigQuery(rf.options_sql, project);
            } catch { /* ignore */ }
          }

          let targetTileIds = rf.target_tile_ids || [];
          if (rf.target_tile_titles && Array.isArray(rf.target_tile_titles)) {
            const matched = targetDoc.tiles
              .filter((t) => rf.target_tile_titles.some((title: string) => t.title.toLowerCase().includes(title.toLowerCase())))
              .map((t) => t.id);
            targetTileIds = [...new Set([...targetTileIds, ...matched])];
          }

          const filter: AppFilterControl = {
            id: generateId('filter'),
            label: rf.label,
            paramName: rf.param_name || rf.label.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            column: rf.column,
            targetTileIds: targetTileIds.length > 0 ? targetTileIds : undefined,
            type: (rf.type as FilterControlType) || 'DROPDOWN',
            defaultValue: rf.default_value ?? null,
            options,
            optionsSql: rf.options_sql,
            min: rf.min,
            max: rf.max,
          };
          targetDoc.globalFilters = targetDoc.globalFilters || [];
          targetDoc.globalFilters.push(filter);
          addedFilters.push(filter);
        }

        targetDoc.updatedAt = new Date().toISOString();
        setGlobalBuilderDocuments(openDocs);

        if (uid) {
          try {
            await saveBuilderDocument(uid, targetDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving filter:', e);
          }
        }

        return {
          data: {
            action: 'ADD_FILTER',
            document_id: targetDoc.id,
            name: targetDoc.name,
            filters: (targetDoc.globalFilters || []).map((f) => ({ id: f.id, label: f.label, param: f.paramName, column: f.column, type: f.type, options: f.options })),
          },
        };
      }

      // ── 7. UPDATE_FILTER ────────────────────────────────────────────────────
      if (action === 'UPDATE_FILTER') {
        const targetDoc = getTargetDoc();
        if (!targetDoc) return { data: { error: 'No active dashboard found.' } };

        const filterId = args.filter_id as string;
        const filterLabel = (args.filters?.[0]?.label || args.document_name) as string;

        let targetFilter = targetDoc.globalFilters?.find((f) => f.id === filterId);
        if (!targetFilter && filterLabel && targetDoc.globalFilters) {
          targetFilter = targetDoc.globalFilters.find((f) => f.label.toLowerCase().includes(filterLabel.toLowerCase()));
        }

        if (!targetFilter) {
          return { data: { error: 'Could not find filter to update.' } };
        }

        const updateData = args.filters?.[0] || {};
        if (updateData.label) targetFilter.label = updateData.label;
        if (updateData.param_name) targetFilter.paramName = updateData.param_name;
        if (updateData.column) targetFilter.column = updateData.column;
        if (updateData.type) targetFilter.type = updateData.type as FilterControlType;
        if (updateData.options) targetFilter.options = updateData.options;
        if (updateData.options_sql) targetFilter.optionsSql = updateData.options_sql;
        if (updateData.default_value !== undefined) targetFilter.defaultValue = updateData.default_value;

        targetDoc.updatedAt = new Date().toISOString();
        setGlobalBuilderDocuments(openDocs);

        if (uid) {
          try {
            await saveBuilderDocument(uid, targetDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving updated filter:', e);
          }
        }

        return {
          data: {
            action: 'UPDATE_FILTER',
            document_id: targetDoc.id,
            filter: targetFilter,
          },
        };
      }

      // ── 8. DELETE_FILTER ────────────────────────────────────────────────────
      if (action === 'DELETE_FILTER') {
        const targetDoc = getTargetDoc();
        if (!targetDoc) return { data: { error: 'No active dashboard found.' } };

        const filterId = args.filter_id as string;
        const filterLabel = (args.filters?.[0]?.label || args.document_name) as string;

        if (targetDoc.globalFilters) {
          targetDoc.globalFilters = targetDoc.globalFilters.filter((f) => {
            if (filterId && f.id === filterId) return false;
            if (filterLabel && f.label.toLowerCase().includes(filterLabel.toLowerCase())) return false;
            return true;
          });
        }

        targetDoc.updatedAt = new Date().toISOString();
        setGlobalBuilderDocuments(openDocs);

        if (uid) {
          try {
            await saveBuilderDocument(uid, targetDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving document after deleting filter:', e);
          }
        }

        return {
          data: {
            action: 'DELETE_FILTER',
            document_id: targetDoc.id,
            remaining_filters: targetDoc.globalFilters || [],
          },
        };
      }

      // ── 9. UPDATE_DASHBOARD / UPDATE_LAYOUT ──────────────────────────────────
      if (action === 'UPDATE_DASHBOARD' || action === 'UPDATE_LAYOUT') {
        const targetDoc = getTargetDoc();
        if (!targetDoc) return { data: { error: 'No active dashboard found.' } };

        if (args.document_name) targetDoc.name = args.document_name as string;
        if (args.description) targetDoc.description = args.description as string;
        if (args.density) targetDoc.density = args.density as any;

        targetDoc.updatedAt = new Date().toISOString();
        setGlobalBuilderDocuments(openDocs);

        if (uid) {
          try {
            await saveBuilderDocument(uid, targetDoc);
          } catch (e) {
            console.warn('[manage_app] Error saving dashboard updates:', e);
          }
        }

        return {
          data: {
            action,
            document_id: targetDoc.id,
            name: targetDoc.name,
            description: targetDoc.description,
            density: targetDoc.density,
          },
        };
      }

      // ── 10. EXPORT_BIGQUERY ─────────────────────────────────────────────────
      if (action === 'EXPORT_BIGQUERY') {
        const targetDoc = getTargetDoc();
        if (!targetDoc) return { data: { error: 'No dashboard found to export to BigQuery.' } };
        if (!project) return { data: { error: 'Google Cloud Project is required for BigQuery export.' } };

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

      // ── 11. DELETE ──────────────────────────────────────────────────────────
      if (action === 'DELETE') {
        const targetDocId = (args.document_id as string) || openDocs[0]?.id;
        const tileId = args.tile_id as string;

        if (tileId && targetDocId) {
          const doc = openDocs.find((d) => d.id === targetDocId);
          if (doc) {
            doc.tiles = doc.tiles.filter((t) => t.id !== tileId);
            setGlobalBuilderDocuments(openDocs);
            if (uid) {
              try { await saveBuilderDocument(uid, doc); } catch {}
            }
            return { data: { action: 'DELETE', deleted_tile: tileId, document_id: targetDocId } };
          }
        } else if (targetDocId) {
          openDocs = openDocs.filter((d) => d.id !== targetDocId);
          setGlobalBuilderDocuments(openDocs);
          if (uid) {
            try { await deleteBuilderDocument(uid, targetDocId); } catch {}
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
