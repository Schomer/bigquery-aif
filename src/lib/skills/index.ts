// src/lib/skills/index.ts
// Skill registry. After removing the legacy handler system,
// this file only re-exports schema utilities used by the agent tools.

// The schema module is the only surviving skill file -- it provides
// fetchSchema() used by the agent's get_schema and list_resources tools.
export { fetchSchema } from './schema';

// Confirmed operation execution (extracted from legacy handle-data-management.ts)
export { executeConfirmedOperation } from './execute-confirmed';
