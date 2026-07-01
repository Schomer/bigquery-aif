// src/lib/tasks/learned-plans.ts
// Firestore persistence for learned task plans.
// Plans are stored in a top-level 'learnedPlans' collection, keyed by plan ID,
// and shared across users (scoped by project field).

import { doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { LearnedPlan } from './types';

// -- In-memory cache --
// Loaded once per session per project, then served from memory.

const cache = new Map<string, LearnedPlan[]>();
let cacheLoadedForProject: string | null = null;

function plansCollection() {
  return collection(db, 'learnedPlans');
}

/**
 * Fetch all learned plans for a project. Uses in-memory cache after first load.
 */
export async function getLearnedPlans(project: string): Promise<LearnedPlan[]> {
  if (cacheLoadedForProject === project && cache.has(project)) {
    return cache.get(project)!;
  }

  try {
    const q = query(plansCollection(), where('project', '==', project));
    const snapshot = await getDocs(q);
    const plans: LearnedPlan[] = [];
    snapshot.forEach((docSnap) => {
      plans.push(docSnap.data() as LearnedPlan);
    });
    cache.set(project, plans);
    cacheLoadedForProject = project;
    return plans;
  } catch (err) {
    console.warn('[learned-plans] Failed to load plans:', err);
    return [];
  }
}

/**
 * Save a new learned plan to Firestore and update the cache.
 */
export async function saveLearnedPlan(plan: LearnedPlan): Promise<void> {
  try {
    await setDoc(doc(db, 'learnedPlans', plan.id), plan);
    // Update cache
    const cached = cache.get(plan.project) || [];
    cached.push(plan);
    cache.set(plan.project, cached);
    cacheLoadedForProject = plan.project;
  } catch (err) {
    console.warn('[learned-plans] Failed to save plan:', err);
    throw err;
  }
}

/**
 * Update fields on an existing learned plan.
 */
export async function updateLearnedPlan(id: string, updates: Partial<LearnedPlan>): Promise<void> {
  try {
    const ref = doc(db, 'learnedPlans', id);
    await updateDoc(ref, updates);
    // Refresh cache entry if present
    for (const [project, plans] of cache.entries()) {
      const idx = plans.findIndex((p) => p.id === id);
      if (idx !== -1) {
        plans[idx] = { ...plans[idx], ...updates } as LearnedPlan;
        cache.set(project, plans);
        break;
      }
    }
  } catch (err) {
    console.warn('[learned-plans] Failed to update plan:', err);
    throw err;
  }
}

/**
 * Delete a learned plan from Firestore and remove from cache.
 */
export async function deleteLearnedPlan(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'learnedPlans', id));
    // Remove from cache
    for (const [project, plans] of cache.entries()) {
      const filtered = plans.filter((p) => p.id !== id);
      if (filtered.length !== plans.length) {
        cache.set(project, filtered);
        break;
      }
    }
  } catch (err) {
    console.warn('[learned-plans] Failed to delete plan:', err);
    throw err;
  }
}

// -- Keyword extraction --

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'up',
  'down', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'and', 'but', 'or', 'nor', 'if', 'that', 'this', 'what', 'which', 'who',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she',
  'her', 'it', 'its', 'they', 'them', 'their', 'just', 'about', 'also',
  'get', 'got', 'want', 'need', 'please', 'help', 'using', 'use',
]);

/**
 * Extract meaningful keywords from a prompt.
 * Splits on whitespace/punctuation, lowercases, removes stop words, dedupes.
 */
export function extractKeywords(prompt: string): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  return [...new Set(words)];
}
