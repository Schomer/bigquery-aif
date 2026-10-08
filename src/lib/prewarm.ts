// src/lib/prewarm.ts
// Pre-warms the slow first-turn dependencies as soon as the user is signed in
// and a project is active, so the first message does not pay for them:
//
//   1. Skill knowledge docs (9 markdown fetches used by every system prompt)
//   2. The project dataset list (the agent looks this up before its first
//      model call when the conversation has no datasets in context). Going
//      through the get_schema tool populates both the tool cache and the
//      shared schema cache, and warms the TLS connection to BigQuery.
//   3. The IndexedDB result store connection.
//
// Everything here is best-effort and idempotent. Nothing throws.

import { getAccessToken } from './gis-auth';
import { prewarmSkillKnowledge } from '../agent/context';
import { getSchemaTool } from '../agent/tools/get-schema';
import { resultCache } from '../agent/result-cache';

const warmedProjects = new Set<string>();
let sharedWarmStarted = false;

/** Warm project-independent dependencies once per page load. */
function warmShared(): void {
  if (sharedWarmStarted) return;
  sharedWarmStarted = true;
  prewarmSkillKnowledge().catch(() => { /* non-fatal */ });
  resultCache.warm().catch(() => { /* non-fatal */ });
}

/**
 * Kick off pre-warming for `project`. Returns immediately. Requires an OAuth
 * access token to be present; when it is not, the call is a no-op and should
 * be retried once the token arrives (the chat hook does this via its effect
 * dependencies).
 */
export function prewarmForProject(project: string): void {
  if (typeof window === 'undefined') return;
  warmShared();

  if (!project || warmedProjects.has(project) || !getAccessToken()) return;
  warmedProjects.add(project);

  getSchemaTool.execute({}, project)
    .then((result) => {
      // Allow a later retry if the lookup failed (e.g. transient network error).
      if (result.error) warmedProjects.delete(project);
    })
    .catch(() => {
      warmedProjects.delete(project);
    });
}

/** Test/reset hook. */
export function resetPrewarmState(): void {
  warmedProjects.clear();
  sharedWarmStarted = false;
}
