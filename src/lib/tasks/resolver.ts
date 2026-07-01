// src/lib/tasks/resolver.ts
// The brain of the task framework. Resolves natural-language user requests
// into concrete, executable ResolvedPlan objects via a two-phase Gemini approach:
//   1. Identify relevant APIs from the knowledge base index
//   2. Construct a full execution plan using detailed API docs
//
// Also handles learned plan matching, success/failure tracking, and error diagnosis.

import { createGoogle } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ResolvedPlan, ResolvedStep, LearnedPlan } from './types';
import type { StatusCallback } from '../types';
import { getLearnedPlans, saveLearnedPlan, updateLearnedPlan, extractKeywords } from './learned-plans';

// -- Provider setup --
// Uses the same API key as the rest of the app (NEXT_PUBLIC_GEMINI_API_KEY).

function getProvider() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  return createGoogle({ apiKey });
}

function getModel() {
  return getProvider()('gemini-3.5-flash');
}

// -- Zod schemas for structured Gemini outputs --

const apiIdentificationSchema = z.object({
  relevantApis: z.array(z.object({
    filename: z.string().describe('Filename from the index, e.g. "bigquery-migration.md"'),
    relevance: z.string().describe('Brief reason why this API is relevant'),
  })),
  reasoning: z.string().describe('Why these APIs were selected'),
});

const dynamicInputSchema = z.object({
  name: z.string(),
  type: z.enum(['select', 'text', 'textarea', 'file_upload', 'toggle', 'number']),
  label: z.string(),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  helpText: z.string().optional(),
  accept: z.string().optional(),
  multiple: z.boolean().optional(),
  mapsTo: z.string(),
});

const apiCallSpecSchema = z.object({
  url: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  bodyTemplate: z.record(z.string(), z.unknown()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

const resolvedStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  apiCall: apiCallSpecSchema,
  inputs: z.array(dynamicInputSchema),
  outputMapping: z.record(z.string(), z.string()).optional(),
  iterateOver: z.string().optional(),
});

const resolvedPlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  approach: z.string(),
  alternativeApproaches: z.array(z.string()).optional(),
  steps: z.array(resolvedStepSchema),
});

const semanticMatchSchema = z.object({
  confidence: z.number().min(0).max(1).describe('Semantic similarity 0-1'),
  reasoning: z.string(),
});

const diagnosisSchema = z.object({
  diagnosis: z.string(),
  canFix: z.boolean(),
  fixedPlan: resolvedPlanSchema.optional(),
});

// -- Main resolver --

/**
 * Resolve a user's natural-language message into a concrete execution plan.
 *
 * Flow:
 * 1. Check learned plans for a reusable match
 * 2. Load the API knowledge base index
 * 3. Phase 1: ask Gemini which APIs are relevant
 * 4. Load detailed docs for matched APIs
 * 5. Phase 2: ask Gemini to construct the full plan
 * 6. Return the ResolvedPlan
 */
export async function resolveTask(
  message: string,
  project: string,
  location?: string,
  onStatus?: StatusCallback,
): Promise<ResolvedPlan> {
  const loc = location || 'us';

  // Step 1: Check learned plans
  onStatus?.('Checking for previously learned plans...');
  const learnedMatch = await findMatchingLearnedPlan(message, project);
  if (learnedMatch) {
    onStatus?.('Found a matching learned plan.');
    return learnedMatch;
  }

  // Step 2: Load capability index
  onStatus?.('Loading API knowledge base...');
  const indexContent = await loadKnowledgeFile('index.md');
  if (!indexContent) {
    throw new Error('Failed to load API knowledge base index. Ensure public/api-knowledge/index.md exists.');
  }

  // Step 3: Identify relevant APIs
  onStatus?.('Identifying relevant APIs...');
  const model = getModel();
  const apiMatch = await generateObject({
    model,
    schema: apiIdentificationSchema,
    system: `You are an API routing expert for Google Cloud data services.
Given a user request and a list of available API knowledge base documents,
identify which API docs are most relevant to fulfilling the request.
The user's project is "${project}" in location "${loc}".
Return only filenames that appear in the index.`,
    prompt: `User request: "${message}"

Available API knowledge base:
${indexContent}

Which API documents should I consult to build an execution plan for this request?`,
  });

  const relevantApis = apiMatch.object.relevantApis;
  if (relevantApis.length === 0) {
    throw new Error('Could not identify any relevant APIs for this request. Try rephrasing or being more specific.');
  }

  // Step 4: Load detailed docs for matched APIs
  const apiDocs: string[] = [];
  for (const api of relevantApis) {
    const content = await loadKnowledgeFile(api.filename);
    if (content) {
      apiDocs.push(`--- ${api.filename} ---\n${content}`);
    }
  }

  if (apiDocs.length === 0) {
    throw new Error('Failed to load any API documentation files. Check the api-knowledge directory.');
  }

  // Step 5: Construct the full plan
  onStatus?.('Constructing execution plan...');
  const planResult = await generateObject({
    model,
    schema: resolvedPlanSchema,
    system: `You are a Google Cloud task planner. Given a user request and detailed API documentation,
construct a concrete execution plan with specific API calls, URL templates, and input specifications.

Rules:
- URLs must use {project} and {location} placeholders where needed
- URLs must target googleapis.com domains only
- Each step should have a clear, specific API call
- Input types should match what the API expects
- Use outputMapping to pass data between steps (response field -> context key)
- The mapsTo field on inputs should use dot notation for body params (e.g., "body.sourceDialect")
- For URL params, use the placeholder name (e.g., "datasetId")
- The project is "${project}" and default location is "${loc}"`,
    prompt: `User request: "${message}"

API Documentation:
${apiDocs.join('\n\n')}

Build a step-by-step execution plan with concrete API calls for this request.`,
  });

  return planResult.object as ResolvedPlan;
}

// -- Learned plan matching --

/**
 * Search for a previously learned plan that matches the current request.
 * Uses keyword overlap as a first filter, then Gemini for semantic scoring.
 * Returns the plan (marked as fromLearnedPlan) if confidence >= 0.7.
 */
export async function findMatchingLearnedPlan(
  message: string,
  project: string,
): Promise<ResolvedPlan | null> {
  let plans: LearnedPlan[];
  try {
    plans = await getLearnedPlans(project);
  } catch {
    return null;
  }

  if (plans.length === 0) return null;

  // Keyword overlap filter
  const messageKeywords = extractKeywords(message);
  if (messageKeywords.length === 0) return null;

  const candidates = plans
    .map((plan) => {
      const overlap = plan.keywords.filter((k) => messageKeywords.includes(k)).length;
      const score = overlap / Math.max(messageKeywords.length, plan.keywords.length);
      return { plan, score };
    })
    .filter((c) => c.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (candidates.length === 0) return null;

  // Semantic scoring via Gemini
  const model = getModel();
  const candidateDescriptions = candidates
    .map((c, i) => `[${i}] Original: "${c.plan.originalPrompt}" -> Plan: "${c.plan.plan.title}"`)
    .join('\n');

  const matchResult = await generateObject({
    model,
    schema: z.object({
      bestMatchIndex: z.number().describe('Index of the best matching candidate, or -1 if none match'),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
    system: 'You are a semantic similarity judge. Compare a new user request against previously successful task plans and determine if any is a close enough match to reuse.',
    prompt: `New request: "${message}"

Previously successful plans:
${candidateDescriptions}

Which plan (if any) is semantically similar enough to reuse? A match means the same type of operation on the same type of resource, even if specific names differ.`,
  });

  const match = matchResult.object;
  if (match.bestMatchIndex >= 0 && match.confidence >= 0.7 && match.bestMatchIndex < candidates.length) {
    const matched = candidates[match.bestMatchIndex].plan;
    // Update lastUsedAt
    try {
      await updateLearnedPlan(matched.id, { lastUsedAt: new Date().toISOString() });
    } catch {
      // Non-fatal
    }
    return {
      ...matched.plan,
      fromLearnedPlan: true,
      learnedPlanId: matched.id,
    };
  }

  return null;
}

// -- Success/failure tracking --

/**
 * Called after a plan executes successfully.
 * If it was a learned plan, increments successCount.
 * If it was new, saves it as a learned plan for future reuse.
 */
export async function onTaskSuccess(
  plan: ResolvedPlan,
  originalPrompt: string,
  project: string,
): Promise<void> {
  try {
    if (plan.fromLearnedPlan && plan.learnedPlanId) {
      // Increment success count on existing learned plan
      const plans = await getLearnedPlans(project);
      const existing = plans.find((p) => p.id === plan.learnedPlanId);
      if (existing) {
        await updateLearnedPlan(plan.learnedPlanId, {
          successCount: existing.successCount + 1,
          lastUsedAt: new Date().toISOString(),
        });
      }
    } else {
      // Save as new learned plan
      const id = crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
      const now = new Date().toISOString();
      const learnedPlan: LearnedPlan = {
        id,
        project,
        originalPrompt,
        keywords: extractKeywords(originalPrompt),
        plan: { ...plan, fromLearnedPlan: undefined, learnedPlanId: undefined },
        createdAt: now,
        lastUsedAt: now,
        successCount: 1,
        failureCount: 0,
      };
      await saveLearnedPlan(learnedPlan);
    }
  } catch (err) {
    console.warn('[resolver] Failed to record task success:', err);
  }
}

/**
 * Called after a plan fails execution.
 * If it was a learned plan, increments failureCount.
 */
export async function onTaskFailure(
  plan: ResolvedPlan,
  project: string,
): Promise<void> {
  if (!plan.fromLearnedPlan || !plan.learnedPlanId) return;

  try {
    const plans = await getLearnedPlans(project);
    const existing = plans.find((p) => p.id === plan.learnedPlanId);
    if (existing) {
      await updateLearnedPlan(plan.learnedPlanId, {
        failureCount: existing.failureCount + 1,
      });
    }
  } catch (err) {
    console.warn('[resolver] Failed to record task failure:', err);
  }
}

// -- Error diagnosis --

/**
 * Use Gemini to diagnose an API error and optionally produce a fixed plan.
 */
export async function diagnoseError(
  error: string,
  plan: ResolvedPlan,
  step: ResolvedStep,
): Promise<{ diagnosis: string; fixedPlan?: ResolvedPlan }> {
  try {
    const model = getModel();
    const result = await generateObject({
      model,
      schema: diagnosisSchema,
      system: `You are a Google Cloud API debugging expert. Analyze the error from an API call,
explain what went wrong, and if possible, produce a corrected execution plan.`,
      prompt: `The following API call failed:
Step: ${step.label}
URL: ${step.apiCall.url}
Method: ${step.apiCall.method}
Body template: ${JSON.stringify(step.apiCall.bodyTemplate || {})}

Error: ${error}

Full plan context:
${JSON.stringify(plan, null, 2)}

Diagnose the error and, if possible, provide a fixed version of the entire plan.`,
    });

    const diagnosis = result.object;
    return {
      diagnosis: diagnosis.diagnosis,
      fixedPlan: diagnosis.canFix && diagnosis.fixedPlan
        ? diagnosis.fixedPlan as ResolvedPlan
        : undefined,
    };
  } catch (err) {
    return {
      diagnosis: `Failed to diagnose error: ${err instanceof Error ? err.message : String(err)}. Original error: ${error}`,
    };
  }
}

// -- Knowledge base loading --

/**
 * Load a knowledge base file from /api-knowledge/ via fetch.
 * Returns null if the file doesn't exist or can't be loaded.
 */
async function loadKnowledgeFile(filename: string): Promise<string | null> {
  try {
    // In browser context, fetch from the public directory
    const response = await fetch(`/api-knowledge/${filename}`);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
