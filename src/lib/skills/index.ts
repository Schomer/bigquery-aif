// src/lib/skills/index.ts
// Skill manifest registry. Adding a new skill:
// 1. Create handle-{name}.ts with a manifest export
// 2. Add one import + one array entry here
// That's it. No other files need editing.

import type { SkillManifest } from '../types';

import { manifest as schemaManifest } from './handle-schema';
import { manifest as queryManifest } from './handle-query';
import { manifest as conversationManifest } from './handle-conversation';
import { manifest as dataManagementManifest } from './handle-data-management';
import { manifest as dataQualityManifest } from './handle-data-quality';
import { manifest as monitoringManifest } from './handle-monitoring';
import { manifest as discoveryManifest } from './handle-discovery';
import { manifest as dataLoadingManifest } from './handle-data-loading';
import { manifest as pipelineManifest } from './handle-pipeline';
import { manifest as taskManifest } from './handle-task';
import { manifest as governanceManifest } from './handle-governance';
import { manifest as savedManifest } from './handle-saved';
import { manifest as dashboardManifest } from './handle-dashboard';

export const SKILL_MANIFESTS: SkillManifest[] = [
  schemaManifest,
  queryManifest,
  conversationManifest,
  dataManagementManifest,
  dataQualityManifest,
  monitoringManifest,
  discoveryManifest,
  dataLoadingManifest,
  pipelineManifest,
  taskManifest,
  governanceManifest,
  savedManifest,
  dashboardManifest,
];

/** Map from skill name to manifest for O(1) lookup */
export const SKILL_MAP = new Map<string, SkillManifest>(
  SKILL_MANIFESTS.map(m => [m.skill, m])
);

/** All skill names, derived from manifests */
export const SKILL_NAMES = SKILL_MANIFESTS.map(m => m.skill);

/** All skill labels, derived from manifests */
export const SKILL_LABELS: Record<string, string> = Object.fromEntries(
  SKILL_MANIFESTS.map(m => [m.skill, m.label])
);
