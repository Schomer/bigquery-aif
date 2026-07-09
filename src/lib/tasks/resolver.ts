// src/lib/tasks/resolver.ts
// The brain of the task framework. Resolves natural-language user requests
// into concrete, executable ResolvedPlan objects via a two-phase Gemini approach:
//   1. Identify relevant APIs from the knowledge base index
//   2. Construct a full execution plan using detailed API docs
//
// Also handles learned plan matching, success/failure tracking, and error diagnosis.
// Uses callGeminiWithSchema from the shared gemini-client for all LLM calls.

import { callGeminiWithSchema } from '../gemini-client';
import type { ResolvedPlan, ResolvedStep, LearnedPlan } from './types';
import type { StatusCallback } from '../types';
import { getLearnedPlans, saveLearnedPlan, updateLearnedPlan, extractKeywords } from './learned-plans';
import { matchShortcut } from './actions';

// -- OpenAPI JSON schemas for structured Gemini outputs --
// Equivalent to the former Zod schemas, in the uppercase OpenAPI format
// that callGemini's responseSchema expects.

const apiIdentificationSchema = {
  type: 'OBJECT',
  properties: {
    relevantApis: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          filename: { type: 'STRING' },
          relevance: { type: 'STRING' },
        },
        required: ['filename', 'relevance'],
      },
    },
    reasoning: { type: 'STRING' },
  },
  required: ['relevantApis', 'reasoning'],
};

const dynamicInputSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    type: { type: 'STRING', enum: ['select', 'text', 'textarea', 'file_upload', 'toggle', 'number'] },
    label: { type: 'STRING' },
    required: { type: 'BOOLEAN' },
    options: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          value: { type: 'STRING' },
          label: { type: 'STRING' },
        },
        required: ['value', 'label'],
      },
    },
    placeholder: { type: 'STRING' },
    defaultValue: { type: 'STRING' },
    helpText: { type: 'STRING' },
    accept: { type: 'STRING' },
    multiple: { type: 'BOOLEAN' },
    mapsTo: { type: 'STRING' },
  },
  required: ['name', 'type', 'label', 'required', 'mapsTo'],
};

const apiCallSpecSchema = {
  type: 'OBJECT',
  properties: {
    url: { type: 'STRING' },
    method: { type: 'STRING', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    bodyTemplate: { type: 'OBJECT', properties: {} },
    headers: { type: 'OBJECT', properties: {} },
  },
  required: ['url', 'method'],
};

const resolvedStepSchema = {
  type: 'OBJECT',
  properties: {
    id: { type: 'STRING' },
    label: { type: 'STRING' },
    description: { type: 'STRING' },
    apiCall: apiCallSpecSchema,
    inputs: { type: 'ARRAY', items: dynamicInputSchema },
    outputMapping: { type: 'OBJECT', properties: {} },
    iterateOver: { type: 'STRING' },
  },
  required: ['id', 'label', 'description', 'apiCall', 'inputs'],
};

const resolvedPlanSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    approach: { type: 'STRING' },
    alternativeApproaches: { type: 'ARRAY', items: { type: 'STRING' } },
    steps: { type: 'ARRAY', items: resolvedStepSchema },
  },
  required: ['title', 'description', 'approach', 'steps'],
};

const semanticMatchSchema = {
  type: 'OBJECT',
  properties: {
    bestMatchIndex: { type: 'NUMBER' },
    confidence: { type: 'NUMBER' },
    reasoning: { type: 'STRING' },
  },
  required: ['bestMatchIndex', 'confidence', 'reasoning'],
};

const diagnosisSchema = {
  type: 'OBJECT',
  properties: {
    diagnosis: { type: 'STRING' },
    canFix: { type: 'BOOLEAN' },
    fixedPlan: resolvedPlanSchema,
  },
  required: ['diagnosis', 'canFix'],
};

// -- Types for schema results --

interface ApiIdentificationResult {
  relevantApis: Array<{ filename: string; relevance: string }>;
  reasoning: string;
}

interface SemanticMatchResult {
  bestMatchIndex: number;
  confidence: number;
  reasoning: string;
}

interface DiagnosisResult {
  diagnosis: string;
  canFix: boolean;
  fixedPlan?: ResolvedPlan;
}

// -- Main resolver --

/**
 * Resolve a user's natural-language message into a concrete execution plan.
 *
 * Flow:
 * 1. Check action shortcuts (instant, no LLM call)
 * 2. Check learned plans for a reusable match
 * 3. Load the API knowledge base index
 * 4. Phase 1: ask Gemini which APIs are relevant
 * 5. Load detailed docs for matched APIs
 * 6. Phase 2: ask Gemini to construct the full plan
 * 7. Return the ResolvedPlan
 */
export async function resolveTask(
  message: string,
  project: string,
  location?: string,
  onStatus?: StatusCallback,
): Promise<ResolvedPlan> {
  const loc = location || 'us';

  // Step 1: Check action shortcuts (instant, no LLM call)
  const shortcut = matchShortcut(message);
  if (shortcut) {
    onStatus?.('Matched action shortcut: ' + shortcut.label);
    return shortcut.buildPlan({ project, location: loc, message });
  }

  // Step 2: Check learned plans
  onStatus?.('Checking for previously learned plans...');
  const learnedMatch = await findMatchingLearnedPlan(message, project);
  if (learnedMatch) {
    onStatus?.('Found a matching learned plan.');
    return learnedMatch;
  }

  // Step 3: Load capability index
  onStatus?.('Loading API knowledge base...');
  const indexContent = await loadKnowledgeFile('index.md');
  if (!indexContent) {
    throw new Error('Failed to load API knowledge base index. Ensure public/api-knowledge/index.md exists.');
  }

  // Step 4: Identify relevant APIs
  onStatus?.('Identifying relevant APIs...');
  const apiMatch = await callGeminiWithSchema<ApiIdentificationResult>({
    systemInstruction: `You are an API routing expert for Google Cloud data services.
Given a user request and a list of available API knowledge base documents,
identify which API docs are most relevant to fulfilling the request.
The user's project is "${project}" in location "${loc}".
Return only filenames that appear in the index.`,
    prompt: `User request: "${message}"

Available API knowledge base:
${indexContent}

Which API documents should I consult to build an execution plan for this request?`,
    schema: apiIdentificationSchema,
  });

  const relevantApis = apiMatch.relevantApis;
  if (relevantApis.length === 0) {
    throw new Error('Could not identify any relevant APIs for this request. Try rephrasing or being more specific.');
  }

  // Step 5: Load detailed docs for matched APIs
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

  // Step 6: Construct the full plan
  onStatus?.('Constructing execution plan...');
  const plan = await callGeminiWithSchema<ResolvedPlan>({
    systemInstruction: `You are a Google Cloud task planner. Given a user request and detailed API documentation,
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
    schema: resolvedPlanSchema,
  });

  return plan;
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
  const candidateDescriptions = candidates
    .map((c, i) => `[${i}] Original: "${c.plan.originalPrompt}" -> Plan: "${c.plan.plan.title}"`)
    .join('\n');

  const match = await callGeminiWithSchema<SemanticMatchResult>({
    systemInstruction: 'You are a semantic similarity judge. Compare a new user request against previously successful task plans and determine if any is a close enough match to reuse.',
    prompt: `New request: "${message}"

Previously successful plans:
${candidateDescriptions}

Which plan (if any) is semantically similar enough to reuse? A match means the same type of operation on the same type of resource, even if specific names differ.`,
    schema: semanticMatchSchema,
  });

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
    const diagnosis = await callGeminiWithSchema<DiagnosisResult>({
      systemInstruction: `You are a Google Cloud API debugging expert. Analyze the error from an API call,
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
      schema: diagnosisSchema,
    });

    return {
      diagnosis: diagnosis.diagnosis,
      fixedPlan: diagnosis.canFix && diagnosis.fixedPlan
        ? diagnosis.fixedPlan
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
