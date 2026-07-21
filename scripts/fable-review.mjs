#!/usr/bin/env node
/**
 * fable-review.mjs -- Send codebase context to Claude Fable 5 for review.
 *
 * Usage:
 *   node scripts/fable-review.mjs "Your prompt here"
 *   node scripts/fable-review.mjs --files src/lib/router.ts,src/lib/composer.ts "Review these files"
 *   node scripts/fable-review.mjs --all "Give me a full architecture review"
 *   node scripts/fable-review.mjs --out review.md "Your prompt here"
 *
 * Options:
 *   --files <paths>   Comma-separated file paths (relative to project root)
 *   --all             Include all core source files (~80 files)
 *   --out <path>      Write response to file instead of stdout
 *   --max-tokens <n>  Max output tokens (default 16384)
 *   --system <text>   Override system prompt
 *
 * Environment:
 *   ANTHROPIC_API_KEY  Required. Set in ~/.zshrc or export before running.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const MODEL = 'claude-fable-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.css', '.md']);

function collectFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'out', '.git', '__tests__'].includes(entry.name)) continue;
      results.push(...collectFiles(full, base));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      const stat = statSync(full);
      // Skip very large files (>100KB) unless explicitly requested
      if (stat.size <= 100_000) {
        results.push(relative(base, full));
      }
    }
  }
  return results;
}

const CORE_DIRS = [
  'src/lib',
  'src/hooks',
  'src/app',
];

const CORE_GLOBS = [
  // Key component files (not all -- too large)
  'src/components/ArtifactCard.tsx',
  'src/components/chat/ChatThread.tsx',
  'src/components/chat/ChatInput.tsx',
  'src/components/chat/ResultsSidebar.tsx',
  'src/components/SchemaView.tsx',
  'src/components/DataTable.tsx',
  'src/components/InteractiveWidgetView.tsx',
  'src/components/shell/ShellLayout.tsx',
  'src/components/shell/TopBar.tsx',
];

function getCoreFiles() {
  const files = [];
  for (const dir of CORE_DIRS) {
    const abs = join(PROJECT_ROOT, dir);
    try {
      files.push(...collectFiles(abs, PROJECT_ROOT));
    } catch { /* dir may not exist */ }
  }
  for (const f of CORE_GLOBS) {
    try {
      statSync(join(PROJECT_ROOT, f));
      files.push(f);
    } catch { /* file may not exist */ }
  }
  return [...new Set(files)];
}

function getAllFiles() {
  return collectFiles(join(PROJECT_ROOT, 'src'), PROJECT_ROOT);
}

function readProjectFile(relPath) {
  const abs = join(PROJECT_ROOT, relPath);
  try {
    return readFileSync(abs, 'utf-8');
  } catch (e) {
    return `[Error reading file: ${e.message}]`;
  }
}

function buildFileContext(files) {
  const parts = [];
  let totalSize = 0;
  for (const f of files) {
    const content = readProjectFile(f);
    totalSize += content.length;
    parts.push(`--- FILE: ${f} ---\n${content}\n--- END FILE ---`);
  }
  console.error(`[fable-review] Packaging ${files.length} files (${(totalSize / 1024).toFixed(1)} KB)`);
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Knowledge context
// ---------------------------------------------------------------------------

function loadKnowledge() {
  const knowledgeFiles = [
    '.agents/knowledge/component-map.md',
    '.agents/knowledge/invariants.md',
  ];
  const parts = [];
  for (const f of knowledgeFiles) {
    try {
      const content = readProjectFile(f);
      parts.push(`--- KNOWLEDGE: ${f} ---\n${content}\n--- END KNOWLEDGE ---`);
    } catch { /* skip missing */ }
  }
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function callFable({ systemPrompt, userMessage, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Set it with: export ANTHROPIC_API_KEY="sk-ant-..."');
    process.exit(1);
  }

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };

  console.error(`[fable-review] Calling ${MODEL} (max_tokens: ${maxTokens})...`);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`API error ${res.status}: ${errText}`);
    process.exit(1);
  }

  const data = await res.json();

  if (data.stop_reason === 'refusal') {
    console.error('[fable-review] Fable declined this request (safety classifier). Try rephrasing.');
    process.exit(1);
  }

  const text = data.content
    ?.filter(b => b.type === 'text')
    .map(b => b.text)
    .join('') || '';

  const usage = data.usage || {};
  console.error(`[fable-review] Done. Input tokens: ${usage.input_tokens || '?'}, Output tokens: ${usage.output_tokens || '?'}`);

  return text;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM = `You are an expert code reviewer analyzing a Next.js + TypeScript application called "BigQuery AIF" -- an AI-powered interface for Google BigQuery.

Architecture summary:
- Next.js static export (output: 'export') deployed to Firebase Hosting
- AI calls go through Firebase AI Logic SDK (Gemini 3.5 Flash)
- BigQuery REST API via OAuth2 access tokens (Google Identity Services)
- Skill-based architecture: Router -> Orchestrator -> Skill Handlers -> Composer -> UI Components
- State managed via React contexts (auth, conversation, layout, preferences, page/tabs)

Your job:
1. Understand the code thoroughly before commenting.
2. Be specific -- cite file names, function names, and line ranges.
3. Focus on real issues: bugs, performance problems, maintainability concerns, architectural improvements.
4. Distinguish between critical issues and nice-to-haves.
5. When suggesting changes, show concrete code examples.
6. Do NOT suggest changes that would break the existing architecture without explaining the migration path.`;

function parseArgs(argv) {
  const args = {
    files: null,      // explicit file list
    all: false,       // include all source files
    out: null,        // output file path
    maxTokens: 16384,
    system: null,
    prompt: null,
  };

  const rest = argv.slice(2);
  let i = 0;
  while (i < rest.length) {
    const arg = rest[i];
    if (arg === '--files' && rest[i + 1]) {
      args.files = rest[++i].split(',').map(f => f.trim());
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--out' && rest[i + 1]) {
      args.out = rest[++i];
    } else if (arg === '--max-tokens' && rest[i + 1]) {
      args.maxTokens = parseInt(rest[++i], 10);
    } else if (arg === '--system' && rest[i + 1]) {
      args.system = rest[++i];
    } else if (!arg.startsWith('--')) {
      args.prompt = arg;
    }
    i++;
  }

  if (!args.prompt) {
    console.error('Usage: node scripts/fable-review.mjs [options] "Your prompt"');
    console.error('Run with --help for options.');
    process.exit(1);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  // Determine which files to include
  let files;
  if (args.files) {
    files = args.files;
  } else if (args.all) {
    files = getAllFiles();
  } else {
    files = getCoreFiles();
  }

  const fileContext = buildFileContext(files);
  const knowledge = loadKnowledge();

  const userMessage = `${knowledge}\n\n${fileContext}\n\n---\n\nUser request:\n${args.prompt}`;
  const systemPrompt = args.system || DEFAULT_SYSTEM;

  const response = await callFable({
    systemPrompt,
    userMessage,
    maxTokens: args.maxTokens,
  });

  if (args.out) {
    const outPath = join(PROJECT_ROOT, args.out);
    writeFileSync(outPath, response, 'utf-8');
    console.error(`[fable-review] Response written to ${outPath}`);
  } else {
    process.stdout.write(response);
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
