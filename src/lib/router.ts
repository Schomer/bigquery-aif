// src/lib/router.ts
// Intent classification → skill selection
// Implements bigquery-router-orchestration.md §1-6
//
// Uses a scored multi-signal approach instead of first-match-wins.
// Each signal list contributes a weighted score to candidate skills.
// The highest-scoring skill wins; when two skills score within a margin,
// confidence drops to 'medium' so the LLM classifier can break the tie.

import type { SkillName, HandoffEnvelope } from './types';
import { SKILL_MANIFESTS } from './skills';

// ─── Skill selection signals ──────────────────────────────────────────────────

const MUTATING_VERBS = [
  'delete', 'remove', 'drop', 'update', 'fix', 'merge', 'dedupe', 'deduplicate',
  'alter', 'rename', 'create table', 'create view', 'partition', 'cluster',
  'copy table', 'clone', 'truncate', 'insert into', 'fill null',
  // Copy/duplicate verbs — "duplicate" as a verb means copy, not quality check
  'duplicate', 'copy', 'replicate', 'make a copy',
  // Value transformation verbs that imply UPDATE DML — must route to data-management
  'standardize', 'normaliz', 'format the', 'convert the', 'transform the',
  'replace values', 'replace null', 'set the', 'cast the', 'add a column',
  'add column', 'backfill', 'overwrite', 'populate the', 'uppercase', 'lowercase',
  'trim the', 'clean the', 'fix the', 'correct the',
  // DDL variants — 'create a view' and 'create a table' (with article) won't match without these
  'create a view', 'create a table', 'create or replace',
  'make a table', 'make a new table', 'make table',
  // Merge/upsert variants
  'upsert', 'merge into',
  // W3-05: annotation write-back
  'annotate', 'annotate column', 'describe column', 'set description', 'add description to',
  'add a description', 'update description', 'label column',
  // Dataset / schema creation verbs
  'make a dataset', 'make dataset', 'create a dataset', 'create dataset',
  'new dataset', 'create a new', 'create a schema', 'create schema',
  'drop dataset', 'drop schema', 'delete dataset', 'remove dataset',
  'make a new dataset',
];

// Pre-compiled word-boundary patterns for mutating verbs.
// Prevents table names like "sales_deduped" from false-matching "dedupe".
const MUTATING_VERB_PATTERNS = MUTATING_VERBS.map((verb) => {
  const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 'normaliz' is an intentional prefix to match normalize/normalizing/etc.
  const suffix = verb === 'normaliz' ? '' : '\\b';
  return new RegExp(`\\b${escaped}${suffix}`, 'i');
});

// ─── Meta-conversational patterns ─────────────────────────────────────────────
// Catch reflective/meta questions about past actions before keyword scoring.
// These should always route to conversation regardless of any keyword overlap.
const META_CONVERSATIONAL_PATTERNS: RegExp[] = [
  /\bexplain\s+(?:what|that|this|the|it|your)\b/i,
  /\bwhat\s+(?:did\s+you|just\s+happened|was\s+that|happened)\b/i,
  /\bwhy\s+did\s+(?:you|it|that)\b/i,
  /\btell\s+me\s+(?:what|why|how)\s+(?:you|it|that)\b/i,
  /\bwhat\s+(?:do\s+you\s+mean|are\s+you\s+doing)\b/i,
  /\bcan\s+you\s+explain\b/i,
  /\bhow\s+does\s+(?:this|that)\s+work\b/i,
  /\bsummarize\s+(?:what|the|this|that|your)\b/i,
  /\bwhat\s+does\s+(?:this|that)\s+mean\b/i,
  /\bhelp\s+me\s+understand\b/i,
];


// ─── Scoring engine ───────────────────────────────────────────────────────────

type SignalList = Array<{ phrase: string; weight: number }>;

/**
 * Score a message against a weighted signal list using word-boundary matching.
 * Returns the sum of weights for all matching phrases.
 */
function scoreSignals(lower: string, signals: SignalList): number {
  let score = 0;
  for (const { phrase, weight } of signals) {
    // Use word-boundary matching to avoid substring false positives
    // (e.g., "performance_metrics" table name matching "performance")
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(lower)) {
      score += weight;
    }
  }
  return score;
}

// ─── Context-aware routing boosts ─────────────────────────────────────────────

// Follow-up action patterns: after a read-only skill, these phrases
// suggest the user wants to act on the results (data-management).
const FOLLOWUP_ACTION_PATTERNS = [
  /\b(?:clean|fix|remove|delete)\s+(?:it|them|those|that)\b/i,
  /\b(?:now|go ahead and)\s+(?:clean|fix|remove|delete|dedupe)\b/i,
];

// Follow-up export patterns: after a query, these suggest data-loading.
const FOLLOWUP_EXPORT_PATTERNS = [
  /\b(?:save|export|download)\s+(?:this|that|those|it|the results)\b/i,
];

/**
 * Apply context-aware score boosts based on the previous turn's skill.
 * Returns a map of skill -> bonus score.
 */
function getContextBoosts(
  lower: string,
  lastSkill?: SkillName
): Partial<Record<SkillName, number>> {
  const boosts: Partial<Record<SkillName, number>> = {};
  if (!lastSkill) return boosts;

  // After a data-quality check, action phrases suggest data-management
  if (lastSkill === 'data-quality') {
    if (FOLLOWUP_ACTION_PATTERNS.some(re => re.test(lower))) {
      boosts['data-management'] = 3;
    }
  }

  // After a query, save/export phrases suggest data-loading
  if (lastSkill === 'query') {
    if (FOLLOWUP_EXPORT_PATTERNS.some(re => re.test(lower))) {
      boosts['data-loading'] = 3;
    }
  }

  // After schema viewing, "check it" / "profile it" suggests data-quality
  if (lastSkill === 'schema') {
    if (/\b(?:check|profile|audit)\s+(?:it|this|that)\b/i.test(lower)) {
      boosts['data-quality'] = 3;
    }
  }

  return boosts;
}

// ─── Router output ────────────────────────────────────────────────────────────

export interface RouterOutput {
  skill: SkillName;
  confidence: 'high' | 'medium' | 'low';
  isHandoff: boolean;
  envelope?: Partial<HandoffEnvelope>;
  ambiguousReadWrite: boolean; // true when signals conflict between read and write skills
}

// ─── Main classification function ─────────────────────────────────────────────

export function classifyIntent(
  message: string,
  conversationContext?: {
    lastSkill?: SkillName;
    lastResultRef?: string;
    lastTable?: string;
  }
): RouterOutput {
  const lower = message.toLowerCase();

  // ── Meta-conversational pre-check ───────────────────────────────────────────
  // Reflective questions about past actions route to conversation before any
  // keyword scoring can misclassify them.
  if (META_CONVERSATIONAL_PATTERNS.some(p => p.test(message))) {
    return { skill: 'conversation' as SkillName, confidence: 'high' as const, isHandoff: false, ambiguousReadWrite: false };
  }

  // ── Hard rule: Data Management requires explicit mutating verb ─────────────
  // Mutating verbs are always high confidence — these are unambiguous action words.
  const hasMutatingVerb = MUTATING_VERB_PATTERNS.some((re) => re.test(lower));

  if (hasMutatingVerb) {
    // Check for conflicting quality signals (e.g., "find duplicates" contains
    // "duplicate" which is now a mutating verb, but the full phrase signals quality).
    // Multi-word quality phrases take precedence over single-word verb matches.
    const dqManifest = SKILL_MANIFESTS.find(m => m.skill === 'data-quality');
    const qualityScore = dqManifest ? scoreSignals(lower, dqManifest.signals) : 0;
    if (qualityScore >= 3) {
      // Strong quality signal present alongside a mutating verb — ambiguous.
      // Let the LLM decide.
      return {
        skill: 'data-management',
        confidence: 'medium',
        isHandoff: false,
        ambiguousReadWrite: true,
      };
    }

    return {
      skill: 'data-management',
      confidence: 'high',
      isHandoff: false,
      ambiguousReadWrite: false,
    };
  }

  // ── Filter / equality pattern -> Query ──────────────────────────────────
  // Messages like "show me more about `col` = 'VALUE'" or "filter where col = 42"
  // contain an equality comparison and should go to the query skill.
  // NOTE: bare "where" is too broad ("where does this come from" is discovery).
  const hasEqualityPattern = /[`']?\w+[`']?\s*=\s*(?:'[^']*'|\d+)/i.test(message);
  const hasFilterPhrase = /\bfilter\s+(where|by|the|this|that|it|down|out|only|to)\b/i.test(lower)
    || /\bwhere\s+\w+\s*(=|>|<|!=|like|in\s*\()/i.test(lower);
  if (hasEqualityPattern || hasFilterPhrase) {
    return {
      skill: 'query',
      confidence: 'high',
      isHandoff: false,
      ambiguousReadWrite: false,
    };
  }

  // ── Scored multi-signal classification ──────────────────────────────────────
  // Score each skill based on weighted signal matches, then pick the winner.
  // Signals are loaded from skill manifests -- adding a new skill's signals
  // to its handler manifest automatically includes it in routing.

  const scores: Record<string, number> = {};
  for (const m of SKILL_MANIFESTS) {
    if (m.signals.length > 0) {
      scores[m.skill] = scoreSignals(lower, m.signals);
    }
  }

  // Apply context-aware boosts
  const boosts = getContextBoosts(lower, conversationContext?.lastSkill);
  for (const [skill, boost] of Object.entries(boosts)) {
    scores[skill] = (scores[skill] || 0) + boost;
  }

  // Find the top two scores
  const sorted = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    // No signals matched -- default to conversation with medium confidence (LLM decides)
    return {
      skill: 'conversation',
      confidence: 'medium',
      isHandoff: false,
      ambiguousReadWrite: false,
    };
  }

  const [topSkill, topScore] = sorted[0];
  const secondScore = sorted.length > 1 ? sorted[1][1] : 0;

  // If the top score is from a single low-weight match (weight 1), defer to LLM
  if (topScore <= 1) {
    return {
      skill: topSkill as SkillName,
      confidence: 'medium',
      isHandoff: false,
      ambiguousReadWrite: false,
    };
  }

  // If two skills are within a small margin, flag as ambiguous and defer to LLM
  const margin = topScore - secondScore;
  if (margin <= 1 && secondScore > 0) {
    return {
      skill: topSkill as SkillName,
      confidence: 'medium',
      isHandoff: false,
      ambiguousReadWrite: false,
    };
  }

  // Clear winner — high confidence
  return {
    skill: topSkill as SkillName,
    confidence: 'high',
    isHandoff: false,
    ambiguousReadWrite: false,
  };
}

/**
 * Resolve referential language ("that table", "those rows", "it") against
 * recent conversation context before classifying.
 * Returns the resolved message string.
 */
export function resolveReferences(
  message: string,
  context?: { lastTable?: string; lastResultRef?: string }
): string {
  if (!context?.lastTable) return message;

  // Replace table references — but only "this/that table" and "it" when it
  // appears in a clear table-reference position (after a verb or preposition).
  // Bare "it" is too aggressive ("make it faster" should not become "make orders faster").
  return message
    .replace(/\bthat table\b/gi, context.lastTable)
    .replace(/\bthis table\b/gi, context.lastTable)
    .replace(/\b(?:from|in|on|to|into|of|against|about)\s+it\b/gi, (match) =>
      match.replace(/\bit\b/i, context.lastTable!)
    );
}
