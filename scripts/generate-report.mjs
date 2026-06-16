#!/usr/bin/env node
// scripts/generate-report.mjs
// Reads test-results/results.json and generates test-results/report.md
// — a rich Markdown report with summary table, per-task sections,
//   embedded screenshots, iteration logs, and UX suggestions.
//
// Usage:
//   node scripts/generate-report.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RESULTS_DIR = join(ROOT, 'test-results');
const resultsPath = join(RESULTS_DIR, 'results.json');
const reportPath = join(RESULTS_DIR, 'report.md');

if (!existsSync(resultsPath)) {
  console.error('ERROR: test-results/results.json not found. Run test-loop.mjs first.');
  process.exit(1);
}

const data = JSON.parse(readFileSync(resultsPath, 'utf-8'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status) {
  switch (status) {
    case 'PASS': return '✅ PASS';
    case 'NEEDS_REVIEW': return '⚠️ NEEDS REVIEW';
    case 'FAIL': return '❌ FAIL';
    default: return '⏭️ SKIPPED';
  }
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1_099_511_627_776) return `${(bytes / 1_099_511_627_776).toFixed(1)} TB`;
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${bytes} bytes`;
}

function escapeMarkdown(str = '') {
  return String(str).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function skillBadge(skill) {
  const colors = {
    'schema': '🔵',
    'query': '🟢',
    'data-management': '🟠',
    'data-quality': '🟣',
    'discovery': '🔷',
    'monitoring': '🔴',
    'data-loading': '🟡',
  };
  return `${colors[skill] ?? '⚪'} \`${skill}\``;
}

function groupByCategory(tasks) {
  const groups = {};
  for (const task of tasks) {
    const key = `${task.category}. ${task.categoryName}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
  }
  return groups;
}

// ─── Build report ─────────────────────────────────────────────────────────────

function buildReport(data) {
  const { summary, tasks, runAt, project } = data;
  const lines = [];

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(`# BigQuery AIF — Task Taxonomy Test Report`);
  lines.push('');
  lines.push(`**Run at:** ${new Date(runAt).toLocaleString()}  `);
  lines.push(`**Project:** \`${project}\`  `);
  lines.push(`**Dataset:** \`${data.dataset ?? `${project}.ecomm`}\`  `);
  lines.push('');

  // ── Executive summary ─────────────────────────────────────────────────────
  lines.push('## Executive Summary');
  lines.push('');

  const passRate = Math.round((summary.pass / summary.total) * 100);
  const reviewRate = Math.round((summary.needsReview / summary.total) * 100);

  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total tasks tested | **${summary.total}** |`);
  lines.push(`| ✅ Passing | **${summary.pass}** (${passRate}%) |`);
  lines.push(`| ⚠️ Needs review | **${summary.needsReview}** (${reviewRate}%) |`);
  lines.push(`| ❌ Failed | **${summary.fail}** |`);
  lines.push(`| ⏱ Total run time | ${summary.elapsedSeconds}s |`);
  lines.push('');

  // Progress bar
  const barWidth = 40;
  const passBlocks = Math.round((summary.pass / summary.total) * barWidth);
  const reviewBlocks = Math.round((summary.needsReview / summary.total) * barWidth);
  const failBlocks = barWidth - passBlocks - reviewBlocks;
  const bar = '█'.repeat(passBlocks) + '▒'.repeat(reviewBlocks) + '░'.repeat(Math.max(0, failBlocks));
  lines.push(`\`${bar}\` ${passRate}% passing`);
  lines.push('');

  // ── Category summary table ─────────────────────────────────────────────────
  lines.push('## Results by Category');
  lines.push('');
  lines.push('| # | Category | Tasks | Pass | Needs Review | Fail |');
  lines.push('|---|----------|-------|------|--------------|------|');

  const groups = groupByCategory(tasks);
  for (const [catKey, catTasks] of Object.entries(groups)) {
    const pass = catTasks.filter(t => t.status === 'PASS').length;
    const review = catTasks.filter(t => t.status === 'NEEDS_REVIEW').length;
    const fail = catTasks.filter(t => t.status === 'FAIL').length;
    lines.push(`| ${catTasks[0].category} | ${catTasks[0].categoryName} | ${catTasks.length} | ${pass} | ${review} | ${fail} |`);
  }
  lines.push('');

  // ── Full task table ────────────────────────────────────────────────────────
  lines.push('## All Tasks');
  lines.push('');
  lines.push('| Status | Task | Skill | Artifact Type | Attempts | Notes |');
  lines.push('|--------|------|-------|---------------|----------|-------|');

  for (const task of tasks) {
    const lastAttempt = task.attempts?.[task.attempts.length - 1];
    const finalSkill = lastAttempt?.envelopes?.[0]?.skill ?? task.expectedSkill;
    const finalArtifact = lastAttempt?.envelopes?.[0]?.artifactType ?? task.expectedArtifactType;
    const attempts = task.attempts?.length ?? 0;
    const correctSkill = finalSkill === task.expectedSkill ? '' : ` ⚠ expected \`${task.expectedSkill}\``;

    lines.push(
      `| ${statusBadge(task.status)} | ${escapeMarkdown(task.taskName)} | ${skillBadge(finalSkill)} | \`${finalArtifact ?? '—'}\` | ${attempts} | ${escapeMarkdown(correctSkill)} |`
    );
  }
  lines.push('');

  // ── Per-task detail sections ───────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push('## Detailed Results');
  lines.push('');

  for (const [catKey, catTasks] of Object.entries(groups)) {
    lines.push(`### ${catKey}`);
    lines.push('');

    for (const task of catTasks) {
      const statusIcon = task.status === 'PASS' ? '✅' : task.status === 'NEEDS_REVIEW' ? '⚠️' : '❌';

      lines.push(`#### ${statusIcon} ${task.taskName}`);
      lines.push('');

      // Metadata badges
      const badges = [
        `**Skill:** ${skillBadge(task.expectedSkill)}`,
        `**Artifact:** \`${task.expectedArtifactType}\``,
        task.isDestructive ? '**⚠️ Destructive** (stops at confirmation card)' : null,
      ].filter(Boolean);
      lines.push(badges.join(' &nbsp;·&nbsp; '));
      lines.push('');

      // Attempts log
      if (task.attempts?.length > 0) {
        lines.push('<details>');
        lines.push(`<summary>📋 Attempt log (${task.attempts.length} attempt${task.attempts.length !== 1 ? 's' : ''})</summary>`);
        lines.push('');

        for (const attempt of task.attempts) {
          lines.push(`**Attempt ${attempt.attempt}**`);
          lines.push('');
          lines.push(`> Prompt: *"${attempt.prompt}"*`);
          lines.push('');

          if (attempt.error) {
            lines.push(`> ❌ Error: \`${attempt.error}\``);
          } else if (attempt.evalResult) {
            const icon = attempt.evalResult.pass ? '✅' : '❌';
            lines.push(`> ${icon} ${attempt.evalResult.reason}`);
          }

          if (attempt.envelopes?.length > 0) {
            lines.push('');
            lines.push('| Skill | Artifact | Data | Next Actions |');
            lines.push('|-------|----------|------|--------------|');
            for (const env of attempt.envelopes) {
              const nextActions = env.nextActions?.map(a => `\`${a.label}\``).join(', ') || '—';
              lines.push(`| ${skillBadge(env.skill)} | \`${env.artifactType ?? '—'}\` | ${env.dataSummary ?? '—'} | ${nextActions} |`);
            }
          }
          lines.push('');
        }

        lines.push('</details>');
        lines.push('');
      }

      // Final prompt used
      const finalPrompt = task.finalPrompt || task.attempts?.[task.attempts.length - 1]?.prompt;
      if (finalPrompt) {
        lines.push(`**Final prompt used:**`);
        lines.push(`> *"${finalPrompt}"*`);
        lines.push('');
      }

      // Workflow results
      if (task.workflowResults?.length > 0) {
        lines.push(`**Multi-turn workflow (${task.workflowResults.length} turns):**`);
        lines.push('');
        lines.push('| Turn | Prompt | Skill | Artifact |');
        lines.push('|------|--------|-------|----------|');
        for (const turn of task.workflowResults) {
          lines.push(`| ${turn.turn} | *"${escapeMarkdown(turn.prompt?.substring(0, 60))}${turn.prompt?.length > 60 ? '...' : ''}"* | ${skillBadge(turn.skill)} | \`${turn.artifactType ?? '—'}\` |`);
        }
        lines.push('');
      }

      // Screenshot
      if (task.screenshotPath && existsSync(task.screenshotPath)) {
        const relPath = relative(RESULTS_DIR, task.screenshotPath);
        lines.push(`**UI Screenshot:**`);
        lines.push('');
        lines.push(`![${task.taskName}](./${relPath})`);
        lines.push('');
      } else if (task.status === 'PASS') {
        lines.push(`*Screenshot not captured — run \`node scripts/capture-screenshots.mjs\`*`);
        lines.push('');
      }

      // UX suggestions
      if (task.uxSuggestions?.length > 0) {
        lines.push(`**💡 UX / Experience Suggestions:**`);
        lines.push('');
        for (const suggestion of task.uxSuggestions) {
          lines.push(`- ${suggestion}`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // ── Consolidated UX suggestions ────────────────────────────────────────────
  lines.push('## Consolidated UX Improvement Suggestions');
  lines.push('');
  lines.push('The following issues appeared across multiple tasks and should be prioritized:');
  lines.push('');

  // Collect router misclassifications
  const misrouted = tasks.filter(t => {
    const lastAttempt = t.attempts?.[t.attempts.length - 1];
    const finalSkill = lastAttempt?.envelopes?.[0]?.skill;
    return finalSkill && finalSkill !== t.expectedSkill;
  });

  if (misrouted.length > 0) {
    lines.push('### Router Improvements');
    lines.push('');
    lines.push('These tasks were routed to the wrong skill on at least one attempt:');
    lines.push('');
    for (const t of misrouted) {
      const lastAttempt = t.attempts?.[t.attempts.length - 1];
      const finalSkill = lastAttempt?.envelopes?.[0]?.skill;
      lines.push(`- **${t.taskName}**: routed to \`${finalSkill}\`, expected \`${t.expectedSkill}\``);
    }
    lines.push('');
    lines.push('**Fix**: Add the relevant task keywords to the signal arrays in `src/lib/router.ts`.');
    lines.push('');
  }

  // Multi-turn guidance
  const workflowTasks = tasks.filter(t => t.workflowResults);
  if (workflowTasks.length > 0) {
    lines.push('### Multi-Turn Workflow Guidance');
    lines.push('');
    lines.push(`${workflowTasks.length} tasks have multi-step workflows. The app should:`);
    lines.push('');
    lines.push('1. **Step indicators**: Show a progress breadcrumb when a task has multiple steps (e.g., "Step 2 of 3: Preview → Confirm → Done")');
    lines.push('2. **Contextual handoff chips**: When a task chains to another (via next-action chips), highlight the recommended next step prominently');
    lines.push('3. **Undo support**: For confirmed destructive operations, offer a brief window to undo before the operation is final');
    lines.push('');
  }

  // Tasks that needed review
  const reviewTasks = tasks.filter(t => t.status === 'NEEDS_REVIEW');
  if (reviewTasks.length > 0) {
    lines.push('### Tasks Needing Manual Review');
    lines.push('');
    lines.push('These tasks failed all retry attempts and need investigation:');
    lines.push('');
    for (const t of reviewTasks) {
      const lastError = t.attempts?.findLast(a => a.error || a.evalResult)?.evalResult?.reason
        || t.attempts?.findLast(a => a.error)?.error
        || 'Unknown';
      lines.push('- **' + t.taskName + '** (`' + t.id + '`): ' + lastError);
    }
    lines.push('');
  }

  // ── Appendix: Skills coverage ──────────────────────────────────────────────
  lines.push('## Appendix: Skill Coverage');
  lines.push('');
  const skillCoverage = {};
  for (const task of tasks) {
    const s = task.expectedSkill;
    if (!skillCoverage[s]) skillCoverage[s] = { total: 0, pass: 0 };
    skillCoverage[s].total++;
    if (task.status === 'PASS') skillCoverage[s].pass++;
  }

  lines.push('| Skill | Tasks | Pass | Pass Rate |');
  lines.push('|-------|-------|------|-----------|');
  for (const [skill, counts] of Object.entries(skillCoverage)) {
    const rate = Math.round((counts.pass / counts.total) * 100);
    const bar = '█'.repeat(Math.round(rate / 10)) + '░'.repeat(10 - Math.round(rate / 10));
    lines.push(`| ${skillBadge(skill)} | ${counts.total} | ${counts.pass} | \`${bar}\` ${rate}% |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Generated by \`scripts/generate-report.mjs\` at ${new Date().toLocaleString()}*`);

  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const report = buildReport(data);
writeFileSync(reportPath, report);

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Report Generated                                         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');
console.log(`  Report: ${reportPath}`);
console.log('');

// Print summary
console.log(`  Summary:`);
console.log(`  ✅ PASS:         ${data.summary.pass} / ${data.summary.total}`);
console.log(`  ⚠  NEEDS REVIEW: ${data.summary.needsReview} / ${data.summary.total}`);
console.log(`  ❌ FAIL:         ${data.summary.fail} / ${data.summary.total}`);
console.log('');
console.log('  Open test-results/report.md to view the full report.');
console.log('');
