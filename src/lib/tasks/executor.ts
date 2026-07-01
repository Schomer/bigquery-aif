// src/lib/tasks/executor.ts
// Generic API executor. Takes structured API call specs and runs them
// against the Google Cloud REST APIs with OAuth Bearer token auth.

import type { ApiCallSpec } from './types';

// -- Host allowlist --
// Only these googleapis.com subdomains may be called. This prevents
// the resolver from constructing calls to arbitrary endpoints.

const ALLOWED_API_HOSTS = [
  'bigquery.googleapis.com',
  'bigquerymigration.googleapis.com',
  'bigquerydatatransfer.googleapis.com',
  'bigqueryconnection.googleapis.com',
  'bigqueryreservation.googleapis.com',
  'storage.googleapis.com',
  'datalineage.googleapis.com',
];

interface ExecutionContext {
  project: string;
  location: string;
  accessToken: string;
  priorOutputs: Record<string, unknown>;
}

interface ExecutionResult {
  success: boolean;
  data: unknown;
  error?: string;
}

/**
 * Substitute {placeholders} in a string with values from the provided maps.
 * Checks context fields (project, location), then inputs, then priorOutputs.
 */
function substitutePlaceholders(
  template: string,
  inputs: Record<string, unknown>,
  context: ExecutionContext,
): string {
  const lookup: Record<string, unknown> = {
    project: context.project,
    location: context.location,
    ...context.priorOutputs,
    ...inputs,
  };

  return template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = lookup[key];
    if (value === undefined || value === null) return `{${key}}`;
    return String(value);
  });
}

/**
 * Recursively substitute {placeholders} in a body template object.
 */
function substituteBody(
  body: Record<string, unknown>,
  inputs: Record<string, unknown>,
  context: ExecutionContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      result[key] = substitutePlaceholders(value, inputs, context);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === 'string') {
          return substitutePlaceholders(item, inputs, context);
        }
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return substituteBody(item as Record<string, unknown>, inputs, context);
        }
        return item;
      });
    } else if (value && typeof value === 'object') {
      result[key] = substituteBody(value as Record<string, unknown>, inputs, context);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Validate that a URL targets an allowed Google API host.
 */
function validateHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_API_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Execute a single API call spec with the given inputs and context.
 *
 * 1. Substitutes {project}, {location}, and input values into URL and body
 * 2. Validates the resolved URL host against the allowlist
 * 3. Sends the request with Bearer token auth
 * 4. Returns parsed JSON or error details
 */
export async function executeApiCall(
  spec: ApiCallSpec,
  inputs: Record<string, unknown>,
  context: ExecutionContext,
): Promise<ExecutionResult> {
  // Resolve URL placeholders
  const resolvedUrl = substitutePlaceholders(spec.url, inputs, context);

  // Validate host
  if (!validateHost(resolvedUrl)) {
    return {
      success: false,
      data: null,
      error: `Blocked: host not in allowlist. URL: ${resolvedUrl}`,
    };
  }

  // Build headers
  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.accessToken}`,
    'Content-Type': 'application/json',
    ...spec.headers,
  };

  // Build body
  let body: string | undefined;
  if (spec.bodyTemplate && spec.method !== 'GET') {
    const resolvedBody = substituteBody(spec.bodyTemplate, inputs, context);
    body = JSON.stringify(resolvedBody);
  }

  try {
    const response = await fetch(resolvedUrl, {
      method: spec.method,
      headers,
      body,
    });

    const responseText = await response.text();

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      const errMsg =
        (data && typeof data === 'object' && 'error' in data)
          ? JSON.stringify((data as Record<string, unknown>).error)
          : `HTTP ${response.status}: ${responseText.slice(0, 500)}`;
      return {
        success: false,
        data,
        error: errMsg,
      };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
