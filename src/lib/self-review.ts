// src/lib/self-review.ts
// Self-review refinement pass: a single Gemini call that reviews any composed
// output from the user's perspective across comprehension, completeness,
// presentation, and visual design -- then optionally improves it before the
// envelope reaches the UI.
// Extracted from chat-orchestrator.ts.

import { callGemini, SelfReviewResponseSchema } from './gemini-client';
import { compose } from './composer';
import type {
  CompositionEnvelope,
  QueryResult,
  DataQualityResult,
  MonitoringResult,
  DiscoveryResult,
  StatusCallback,
} from './types';

export function buildReviewSnapshot(envelope: CompositionEnvelope): Record<string, unknown> {
  const data = envelope.primaryArtifact.data as Record<string, unknown> | null;
  const snapshot: Record<string, unknown> = {
    skill: envelope.skill,
    artifactType: envelope.primaryArtifact.type,
    headline: envelope.headline.text,
    headlineTone: envelope.headline.tone,
    insight: envelope.insight ?? null,
    nextActions: envelope.nextActions.map((a) => a.label),
  };

  if (!data) return snapshot;

  // Query-specific fields
  if ('rows' in data && 'columns' in data) {
    const qd = data as unknown as QueryResult;
    snapshot.visualization = qd.suggestedVisualization;
    snapshot.columns = qd.columns;
    snapshot.rowCount = qd.rowCount;
    snapshot.zeroRows = qd.rowCount === 0;
    snapshot.sampleRows = qd.rows.slice(0, 5).map((row) =>
      Object.fromEntries(qd.columns.map((col, i) => [col, (row as unknown[])[i]]))
    );
    snapshot.xAxis = qd.xAxis ?? null;
    snapshot.yAxis = qd.yAxis ?? null;
    snapshot.notableFindings = qd.notableFindings ?? null;
  }

  // Schema-specific fields
  if ('scope' in data && 'columns' in data && data.skill === 'schema') {
    snapshot.scope = data.scope;
    snapshot.dataset = data.dataset ?? null;
    snapshot.table = data.table ?? null;
    const cols = data.columns as Array<{ name: string; type: string }>;
    snapshot.columnCount = cols.length;
    snapshot.columnSample = cols.slice(0, 10).map((c) => `${c.name} (${c.type})`);
  }

  // Data quality fields
  if ('findings' in data && data.skill === 'data-quality') {
    const dq = data as unknown as DataQualityResult;
    snapshot.checkType = dq.checkType;
    snapshot.table = dq.table;
    snapshot.issuesFound = dq.summary.issuesFound;
    snapshot.rowsScanned = dq.summary.rowsScanned;
    snapshot.findingSample = dq.findings.slice(0, 8).map((f) =>
      `${f.column}: ${f.metric}=${f.value} (${f.severity})`
    );
  }

  // Monitoring fields (only for MonitoringResult, not specialized subtypes like StorageBreakdownResult)
  if ('items' in data && data.skill === 'monitoring' && 'summary' in data) {
    const mon = data as unknown as MonitoringResult;
    snapshot.totalJobs = mon.summary.totalJobs;
    snapshot.errorCount = mon.summary.errorCount;
    snapshot.totalBytesProcessed = mon.summary.totalBytesProcessed;
  }

  // Discovery fields
  if ('results' in data && data.skill === 'discovery') {
    const disc = data as unknown as DiscoveryResult;
    snapshot.discoveryType = disc.discoveryType;
    snapshot.resultCount = disc.results.length;
    snapshot.resultSample = disc.results.slice(0, 5).map((r) => `${r.type}: ${r.ref}`);
  }

  return snapshot;
}

export async function selfReviewEnvelope(
  envelope: CompositionEnvelope,
  userMessage: string,
  project: string,
  _onStatus?: StatusCallback,
): Promise<CompositionEnvelope> {
  const snapshot = buildReviewSnapshot(envelope);

  const reviewPrompt = `You are a senior data analyst, expert graphic designer, and UI designer reviewing output from a BigQuery data assistant. A user asked a question and the assistant produced a result. Your job is to review the output and decide if anything should be improved BEFORE it reaches the user.

The output's skill type is: ${envelope.skill}
The artifact type is: ${envelope.primaryArtifact.type}

Evaluate these five dimensions:

1. COMPREHENSION: Is the headline clear and informative? Does it tell the user what they are looking at in plain language? If not, write a better one. A good headline leads with the key finding or answers the user's question directly -- not just "N rows from table" or generic status text.

2. COMPLETENESS: Would a user naturally want additional context? For example: percentage changes, comparisons to baselines, time range annotations, totals, callouts about outliers, or a note about what they should look at first. If so, write a short additionalInsight (1-2 sentences) that adds this context.

3. PRESENTATION: Is the artifact type / visualization the best fit for this data and the user's intent? For query results, consider number of rows, columns, time axes, categorical vs numeric data, part-to-whole relationships, etc. For schema/monitoring/discovery/data-quality results, consider whether the current view type communicates the most important information effectively. Only suggest a betterVisualization if a different type would genuinely improve comprehension -- this field only applies to query skill results.

4. VISUAL DESIGN & LAYOUT: Think as an expert graphic designer and UI designer. Evaluate the overall presentation quality:
   - Is the headline written in a way that feels polished and professional, not generic or robotic?
   - Would the output feel like it came from a premium, highly-designed application?
   - For data with columns: which columns/series are the most important to the user's question and should be visually emphasized? Which are supporting detail that should be de-emphasized so the layout feels clean and focused?
   - Write a designNotes field with brief, actionable guidance on spacing, hierarchy, or emphasis that would elevate the visual quality (e.g., "Lead with the total revenue KPI, group the breakdown below", "De-emphasize the ID columns to reduce clutter").

5. BRIEFING: Write a short conversational summary (1-2 sentences) that the user will see above the data card. It should explain what was done and what the results show, written from the assistant's perspective (e.g., "I queried the orders table and found 48,920 records across 12 regions."). Optionally include up to 4 key findings as label/value pairs that highlight the most important numbers or takeaways (e.g., {label: "Top Region", value: "US-West", detail: "38% of total orders"}). Always write a briefingNarrative. Only include briefingFindings when the data has notable metrics worth calling out.

Rules:
- Only return fields where you have an actual improvement. Leave fields empty/null if the current output is already good. Exception: always return briefingNarrative.
- Do not repeat what is already there -- only override if you can make it measurably better.
- Keep headlines under 120 characters. Write them as a human analyst would speak, not as a system status message.
- Keep insights under 200 characters.
- designNotes should be under 200 characters.
- briefingNarrative should be under 250 characters. Write it as natural speech, not a system message.
- briefingFindings should have at most 4 items. Each label should be 1-3 words. Each value should be concise.
- For highlightColumns and deemphasizeColumns, use exact column names from the data (only applies to query results with columns).
- CRITICAL: If the result has zero rows (rowCount = 0 or zeroRows = true), the headline MUST acknowledge that the query returned no data and suggest a likely reason (permissions, region, filter, empty table). Do NOT write an optimistic or descriptive headline for an empty result.`;

  try {
    const review = await callGemini({
      systemInstruction: reviewPrompt,
      prompt: `User's question: "${userMessage}"

Current output snapshot:
${JSON.stringify(snapshot, null, 2)}`,
      schema: SelfReviewResponseSchema,
      project,
    });

    if (!review) return envelope;

    // Apply non-empty overrides
    const updated = { ...envelope };
    updated.headline = { ...envelope.headline };
    updated.primaryArtifact = { ...envelope.primaryArtifact };

    if (review.improvedHeadline) {
      updated.headline.text = review.improvedHeadline;
    }

    if (review.additionalInsight) {
      updated.insight = review.additionalInsight;
    }

    // Visualization override only applies to query-skill envelopes
    const data = envelope.primaryArtifact.data as Record<string, unknown> | null;
    if (envelope.skill === 'query' && data && 'rows' in data) {
      const qd = data as unknown as QueryResult;

      if (review.betterVisualization && review.betterVisualization !== qd.suggestedVisualization) {
        const updatedData = { ...qd, suggestedVisualization: review.betterVisualization };
        if (review.improvedXAxis) updatedData.xAxis = review.improvedXAxis;
        if (review.improvedYAxis && review.improvedYAxis.length > 0) updatedData.yAxis = review.improvedYAxis;
        const recomposed = compose('query', updatedData);
        if (review.improvedHeadline) recomposed.headline.text = review.improvedHeadline;
        if (review.additionalInsight) recomposed.insight = review.additionalInsight;
        if (review.highlightColumns?.length || review.deemphasizeColumns?.length) {
          recomposed.primaryArtifact.emphasis = {
            highlight: review.highlightColumns ?? [],
            deemphasize: review.deemphasizeColumns ?? [],
          };
        }
        return recomposed;
      }

      // Apply axis overrides without changing visualization type
      if (review.improvedXAxis || (review.improvedYAxis && review.improvedYAxis.length > 0)) {
        const updatedData = { ...qd };
        if (review.improvedXAxis) updatedData.xAxis = review.improvedXAxis;
        if (review.improvedYAxis && review.improvedYAxis.length > 0) updatedData.yAxis = review.improvedYAxis;
        updated.primaryArtifact = { ...updated.primaryArtifact, data: updatedData };
      }
    }

    // Apply visual emphasis (query results with columns)
    if (review.highlightColumns?.length || review.deemphasizeColumns?.length) {
      updated.primaryArtifact.emphasis = {
        highlight: review.highlightColumns ?? [],
        deemphasize: review.deemphasizeColumns ?? [],
      };
    }

    // Apply briefing (conversational summary for the user)
    if (review.briefingNarrative) {
      updated.briefing = {
        narrative: review.briefingNarrative,
        findings: review.briefingFindings?.length ? review.briefingFindings : undefined,
      };
    }

    return updated;
  } catch (err) {
    // Self-review is non-fatal -- if it fails, return the original envelope
    console.warn('[self-review failed, returning original]', err);
    return envelope;
  }
}
