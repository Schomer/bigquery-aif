import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initTokenManager, getToken } from '../scripts/token-manager.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_PATH = join(ROOT, '.env.local');

// 1. Setup Environment
const lines = readFileSync(ENV_PATH, 'utf-8').split('\n');
const env = {};
for (const line of lines) {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#') && k.trim()) {
    process.env[k.trim()] = v.join('=').trim();
    env[k.trim()] = v.join('=').trim();
  }
}
const PROJECT = env.GOOGLE_PROJECT_ID || 'malloy-data';
const DATASET = 'golden_fixtures';

// 2. Mock Browser Globals
global.window = { location: { hostname: 'localhost' } };
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

// 3. Load dynamic imports
const gisAuth = await import('../src/lib/gis-auth.ts');
const { ChatOrchestrator } = await import('../src/lib/chat-orchestrator.ts');

async function runCases() {
  const tokenOk = await initTokenManager();
  if (!tokenOk) {
    console.error("Token setup failed.");
    process.exit(1);
  }
  gisAuth.setAccessToken(await getToken());

  const casesDir = join(__dirname, 'cases');
  const files = readdirSync(casesDir).filter(f => f.endsWith('.json'));
  
  const results = [];
  let passed = 0;

  for (const file of files) {
    const caseData = JSON.parse(readFileSync(join(casesDir, file), 'utf-8'));
    console.log(`\nRunning case: ${caseData.id}`);

    const start = Date.now();
    let envelopes = [];
    let error = null;

    try {
      const res = await ChatOrchestrator.processMessage({
        message: caseData.prompt,
        history: [],
        context: { project: PROJECT, dataset: DATASET }
      });
      envelopes = res.envelopes;
    } catch (e) {
      error = e.message;
    }

    const latency_ms = Date.now() - start;
    
    // Evaluate Envelopes
    const skillsCalled = envelopes.map(e => e.skill).filter(Boolean);
    const gateFired = envelopes.some(e => e.requiresConfirmation) ? 'gate' : null; // simplified extraction
    const askedUser = envelopes.some(e => e.skill === 'conversation'); 
    
    const textAnswers = envelopes
      .map(e => e.primaryArtifact?.data?.text || e.headline?.text || '')
      .join(' ');

    let pass = true;
    const reasons = [];

    if (error) {
      pass = false;
      reasons.push(`Error: ${error}`);
    }

    if (caseData.assert) {
      if (caseData.assert.latency_budget_ms && latency_ms > caseData.assert.latency_budget_ms) {
        pass = false;
        reasons.push(`Latency ${latency_ms}ms > ${caseData.assert.latency_budget_ms}ms`);
      }
      
      if (caseData.assert.tools_called) {
        for (const constraint of caseData.assert.tools_called) {
          // normalize tool names for test compatibility (e.g. 'execute_query' -> 'query')
          const targetSkill = constraint.name === 'execute_query' ? 'query' : 
                              constraint.name === 'get_schema' ? 'schema' : constraint.name;
          const count = skillsCalled.filter(s => s === targetSkill).length;
          if (constraint.max !== undefined && count > constraint.max) {
             pass = false; reasons.push(`Tool ${targetSkill} called ${count} times (max ${constraint.max})`);
          }
          if (constraint.min !== undefined && count < constraint.min) {
             pass = false; reasons.push(`Tool ${targetSkill} called ${count} times (min ${constraint.min})`);
          }
        }
      }

      if (caseData.assert.asked_user !== undefined) {
        if (askedUser !== caseData.assert.asked_user) {
          pass = false; reasons.push(`asked_user was ${askedUser} but expected ${caseData.assert.asked_user}`);
        }
      }
      
      if (caseData.assert.gate_fired !== undefined && caseData.assert.gate_fired !== null) {
        if (!gateFired) {
          pass = false; reasons.push(`Expected gate but none fired`);
        }
      }
      
      if (caseData.assert.gate_fired === null) {
         if (gateFired) {
           pass = false; reasons.push(`Expected NO gate but gate fired`);
         }
      }
    }

    if (pass) {
      passed++;
      console.log(`✅ PASS (${latency_ms}ms)`);
    } else {
      console.log(`❌ FAIL (${latency_ms}ms): ${reasons.join(', ')}`);
    }

    results.push({
      case_id: caseData.id,
      pass,
      reason: reasons.join('; '),
      latency_ms,
      retries: 0,
      tools_called: skillsCalled,
      gate_fired: gateFired,
      asked_user: askedUser,
      answer: textAnswers,
      raw_envelopes: envelopes
    });
  }

  console.log(`\n--- Results: ${passed}/${files.length} Passed ---`);

  const resultsDir = join(__dirname, 'results');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = join(resultsDir, `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`Saved full results to ${outFile}`);
}

runCases().catch(e => {
  console.error(e);
  process.exit(1);
});
