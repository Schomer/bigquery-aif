// src/lib/dataform-client.ts
// Client-side BigQuery Studio / Dataform REST API integration using OAuth access token.

import { getAccessToken } from './gis-auth';
import { detectBqRegion, handleAuthError } from './bigquery-client';

const DATAFORM_BASE = 'https://dataform.googleapis.com/v1/projects';

export interface StudioQueryItem {
  name: string;
  path: string;
  type: 'sql' | 'sqlx';
}

export interface StudioWorkspaceContext {
  projectId: string;
  location: string;
  repositoryId: string;
  workspaceId: string;
}

// ── Shared fetch helper ──────────────────────────────────────────────────────

async function dataformFetch(url: string, init?: RequestInit): Promise<any> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Cloud. Please sign in again.');
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const status = res.status;
    const msg = data?.error?.message || data?.error || `HTTP ${status}`;
    const isAuth =
      status === 401 ||
      String(msg).toLowerCase().includes('unauthenticated') ||
      String(msg).toLowerCase().includes('oauth 2 access token');
    if (isAuth) {
      handleAuthError();
    }
    throw new Error(String(msg));
  }
  return data;
}

// ── Repository & Workspace Management ────────────────────────────────────────

export async function listDataformRepositories(
  project: string,
  location: string,
): Promise<Array<{ id: string; name: string }>> {
  const url = `${DATAFORM_BASE}/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/repositories`;
  try {
    const data = await dataformFetch(url);
    const repos = data.repositories || [];
    return repos.map((r: any) => {
      const parts = (r.name || '').split('/');
      const id = parts[parts.length - 1] || r.name;
      return { id, name: r.name };
    });
  } catch (err: any) {
    // If Dataform API is not yet enabled or no repos found, return empty array
    if (String(err?.message || '').toLowerCase().includes('not found') || String(err?.message || '').toLowerCase().includes('has not been used')) {
      return [];
    }
    throw err;
  }
}

export async function createDataformRepository(
  project: string,
  location: string,
  repositoryId: string,
): Promise<{ id: string; name: string }> {
  const url = `${DATAFORM_BASE}/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/repositories?repositoryId=${encodeURIComponent(repositoryId)}`;
  const data = await dataformFetch(url, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const parts = (data.name || '').split('/');
  const id = parts[parts.length - 1] || repositoryId;
  return { id, name: data.name };
}

export async function listDataformWorkspaces(
  project: string,
  location: string,
  repositoryId: string,
): Promise<Array<{ id: string; name: string }>> {
  const url = `${DATAFORM_BASE}/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/repositories/${encodeURIComponent(repositoryId)}/workspaces`;
  try {
    const data = await dataformFetch(url);
    const workspaces = data.workspaces || [];
    return workspaces.map((w: any) => {
      const parts = (w.name || '').split('/');
      const id = parts[parts.length - 1] || w.name;
      return { id, name: w.name };
    });
  } catch {
    return [];
  }
}

export async function createDataformWorkspace(
  project: string,
  location: string,
  repositoryId: string,
  workspaceId: string,
): Promise<{ id: string; name: string }> {
  const url = `${DATAFORM_BASE}/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/repositories/${encodeURIComponent(repositoryId)}/workspaces?workspaceId=${encodeURIComponent(workspaceId)}`;
  const data = await dataformFetch(url, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const parts = (data.name || '').split('/');
  const id = parts[parts.length - 1] || workspaceId;
  return { id, name: data.name };
}

/**
 * Normalizes BigQuery multi-region names (US, EU) to valid Dataform regional locations.
 * Dataform is a regional service and does not accept multi-regions like 'us' or 'eu'.
 */
export function normalizeDataformLocation(bqLocation: string): string {
  const loc = (bqLocation || '').toLowerCase().trim();
  if (!loc || loc === 'us' || loc === 'us-multi' || loc === 'united states') {
    return 'us-central1';
  }
  if (loc === 'eu' || loc === 'eu-multi' || loc === 'europe') {
    return 'europe-west1';
  }
  if (loc === 'asia') {
    return 'asia-northeast1';
  }
  return loc;
}

/**
 * Automatically discovers or initializes a Dataform repository and workspace
 * in the project to store and browse BigQuery Studio queries.
 */
export async function ensureStudioWorkspace(
  project: string,
  customLocation?: string,
): Promise<StudioWorkspaceContext> {
  const rawLoc = customLocation || await detectBqRegion(project) || 'us-central1';
  let location = normalizeDataformLocation(rawLoc);

  // 1. List existing repositories in this location
  let repos: Array<{ id: string; name: string }> = [];
  try {
    repos = await listDataformRepositories(project, location);
  } catch {
    // If the detected location fails, fallback to us-central1
    if (location !== 'us-central1') {
      try {
        location = 'us-central1';
        repos = await listDataformRepositories(project, location);
      } catch {
        repos = [];
      }
    }
  }

  let repoId = repos.length > 0 ? repos[0].id : '';

  // 2. If no repository exists, create default 'studio-queries'
  if (!repoId) {
    try {
      const newRepo = await createDataformRepository(project, location, 'studio-queries');
      repoId = newRepo.id;
    } catch (err: any) {
      // If creation failed in this location, try us-central1 as last resort
      if (location !== 'us-central1') {
        location = 'us-central1';
        const newRepo = await createDataformRepository(project, location, 'studio-queries');
        repoId = newRepo.id;
      } else {
        throw err;
      }
    }
  }

  // 3. List workspaces in this repository
  const workspaces = await listDataformWorkspaces(project, location, repoId);
  let workspaceId = workspaces.length > 0 ? workspaces[0].id : '';

  // 4. If no workspace exists, create 'studio-workspace' (Dataform forbids naming workspaces the same as the default branch like 'main'/'master')
  if (!workspaceId) {
    try {
      const newWs = await createDataformWorkspace(project, location, repoId, 'studio-workspace');
      workspaceId = newWs.id;
    } catch {
      const fallbackWs = await createDataformWorkspace(project, location, repoId, 'workspace');
      workspaceId = fallbackWs.id;
    }
  }

  return {
    projectId: project,
    location,
    repositoryId: repoId,
    workspaceId,
  };
}

// ── Query Asset Operations ───────────────────────────────────────────────────

/**
 * List all saved SQL / SQLX query files from a BigQuery Studio workspace.
 */
export async function listStudioSavedQueries(
  project: string,
  location: string,
  repositoryId: string,
  workspaceId: string,
  subfolder: string = 'queries',
): Promise<StudioQueryItem[]> {
  const queryDirectory = async (dirPath: string): Promise<Array<{ file?: string; directory?: string }>> => {
    const url = `${DATAFORM_BASE}/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/repositories/${encodeURIComponent(repositoryId)}/workspaces/${encodeURIComponent(workspaceId)}:queryDirectoryContents?path=${encodeURIComponent(dirPath)}`;
    try {
      const data = await dataformFetch(url);
      return data.directoryEntries || [];
    } catch {
      return [];
    }
  };

  // Try listing from 'queries' subfolder, or fallback to root workspace if empty
  let entries = await queryDirectory(subfolder);
  if (entries.length === 0) {
    entries = await queryDirectory('');
  }

  const queryItems: StudioQueryItem[] = [];

  for (const entry of entries) {
    if (entry.file && (entry.file.endsWith('.sql') || entry.file.endsWith('.sqlx'))) {
      const filePath = entry.file;
      const fileName = filePath.split('/').pop()?.replace(/\.(sql|sqlx)$/, '') || filePath;
      const type = entry.file.endsWith('.sqlx') ? 'sqlx' : 'sql';
      queryItems.push({
        name: fileName,
        path: filePath,
        type,
      });
    }
  }

  return queryItems;
}

/**
 * Read the SQL content of a saved query file from the BigQuery Studio workspace.
 */
export async function readStudioSavedQuery(
  project: string,
  location: string,
  repositoryId: string,
  workspaceId: string,
  filePath: string,
): Promise<string> {
  const url = `${DATAFORM_BASE}/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/repositories/${encodeURIComponent(repositoryId)}/workspaces/${encodeURIComponent(workspaceId)}:readFile?path=${encodeURIComponent(filePath)}`;
  const data = await dataformFetch(url);
  const base64Contents = data.contents || '';

  if (!base64Contents) return '';

  if (typeof window !== 'undefined') {
    try {
      return decodeURIComponent(escape(atob(base64Contents)));
    } catch {
      return atob(base64Contents);
    }
  } else {
    return Buffer.from(base64Contents, 'base64').toString('utf-8');
  }
}

/**
 * Write a SQL query into the BigQuery Studio workspace as a code asset (.sql).
 */
export async function saveStudioSavedQuery(
  project: string,
  location: string,
  repositoryId: string,
  workspaceId: string,
  queryName: string,
  sql: string,
  description?: string,
): Promise<{ path: string; fullTarget: string }> {
  const sanitizedName = queryName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'saved_query';
  const filePath = `queries/${sanitizedName}.sql`;

  const header = description && description.trim()
    ? `-- Description: ${description.trim()}\n-- Saved from BigQuery AI\n\n`
    : `-- Saved from BigQuery AI\n\n`;

  const fullContent = `${header}${sql.trim()}\n`;

  const base64Content = typeof window !== 'undefined'
    ? btoa(unescape(encodeURIComponent(fullContent)))
    : Buffer.from(fullContent).toString('base64');

  const url = `${DATAFORM_BASE}/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/repositories/${encodeURIComponent(repositoryId)}/workspaces/${encodeURIComponent(workspaceId)}:writeFile`;

  await dataformFetch(url, {
    method: 'POST',
    body: JSON.stringify({
      path: filePath,
      contents: base64Content,
    }),
  });

  // Best-effort commit to record in version history
  try {
    const commitUrl = `${DATAFORM_BASE}/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/repositories/${encodeURIComponent(repositoryId)}/workspaces/${encodeURIComponent(workspaceId)}:commit`;
    await dataformFetch(commitUrl, {
      method: 'POST',
      body: JSON.stringify({
        author: {
          name: 'BigQuery AI',
          emailAddress: 'bqaif@users.noreply.google.com',
        },
        commitMessage: `Save query: ${sanitizedName}`,
      }),
    });
  } catch {
    // Non-blocking if commit fails (file write succeeded)
  }

  return {
    path: filePath,
    fullTarget: `${project}/${location}/${repositoryId}/${workspaceId}/${filePath}`,
  };
}
