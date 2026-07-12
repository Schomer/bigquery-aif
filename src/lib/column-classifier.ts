/**
 * Semantic Column Classifier
 *
 * Assigns each column in a query result a ColumnRole using three layers of
 * evidence in priority order:
 *   1. Authoritative BigQuery type (DATE, FLOAT64, etc.)
 *   2. Name pattern matching — splits on underscores so prefixed names like
 *      circuit_latitude, stop_lon, or us_state_name all match correctly.
 *   3. Sample value analysis — data-driven fallback when names are opaque.
 *
 * All consumers (visualization selector, map renderer, axis resolver) should
 * call classifyColumns() and read roles rather than re-implementing their own
 * name-guessing patterns.
 */

export type ColumnRole =
  | 'geo-lat'      // Latitude coordinate
  | 'geo-lng'      // Longitude coordinate
  | 'geo-state'    // US state (name or abbreviation)
  | 'geo-country'  // Country (name or ISO code)
  | 'date'         // Date / timestamp / time period
  | 'measure'      // Numeric metric (quantity, amount, rate)
  | 'id'           // Surrogate key / identifier (suppress from charts)
  | 'label'        // Short categorical text — good for axis labels
  | 'text'         // Long free text — better in a table
  | 'unknown';

// ── BQ authoritative types ───────────────────────────────────────────────────

const BQ_DATE_TYPES = new Set(['DATE', 'DATETIME', 'TIMESTAMP', 'TIME']);
const BQ_NUMERIC_TYPES = new Set([
  'INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC',
  'INT', 'SMALLINT', 'BIGINT', 'FLOAT32',
]);

// ── US state values for sample-value detection ───────────────────────────────

const US_STATE_VALUES = new Set([
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new hampshire','new jersey','new mexico','new york','north carolina',
  'north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island',
  'south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming',
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy',
]);

// ── ISO country values for sample-value detection ────────────────────────────

const ISO_COUNTRY_CODES = new Set([
  'us','gb','de','fr','ca','au','jp','cn','in','br','mx','it','es','kr','ru',
  'nl','ch','se','no','dk','fi','be','at','sg','hk','nz','za','ar','cl','co',
  'pe','eg','ng','ke','gh','th','vn','id','my','ph','tr','sa','ae','il','ir',
  'pk','bd','ua','pl','cz','ro','hu','pt','gr','ie','sk','si','hr','rs','bg',
  'lt','lv','ee','cy','mt','lu','is','al','mk','ba','me','md','am','ge','az',
  'kz','uz','tm','tj','kg','mn','np','lk','mm','kh','la','bt','mv','af','iq',
  'sy','lb','jo','ps','ye','om','kw','bh','qa','tn','dz','ma','ly','sd','et',
  'tz','ug','rw','bi','mz','zm','zw','bw','na','sz','ls','mg','mu','sc',
  'united states','united kingdom','germany','france','canada','australia',
  'japan','china','india','brazil','mexico','italy','spain','south korea',
  'russia','netherlands','switzerland','sweden','norway','denmark',
]);

// ── Date segment patterns ────────────────────────────────────────────────────

const DATE_WHOLE_PATTERN =
  /^(date|time|timestamp|created|updated|modified|month|year|quarter|day|week|hour|period|dt|ts)$/i;
const DATE_SEGMENT_PATTERN =
  /^(date|time|timestamp|created|updated|modified|month|year|quarter|day|week|hour|dt|ts|at)$/i;

// ── Name-pattern helpers (all use underscore-segment splitting) ──────────────

function segs(name: string): string[] {
  return name.toLowerCase().split('_');
}

function hasSegment(name: string, ...targets: string[]): boolean {
  return segs(name).some(s => targets.includes(s));
}

function isLatName(name: string): boolean {
  return hasSegment(name, 'lat', 'latitude');
}

function isLngName(name: string): boolean {
  return hasSegment(name, 'lng', 'lon', 'long', 'longitude');
}

function isIdName(name: string): boolean {
  const parts = segs(name);
  const last = parts[parts.length - 1];
  if (['id', 'key', 'uuid', 'guid', 'hash', 'identifier'].includes(last)) return true;
  if (parts.length === 1 && ['id', 'uuid', 'guid', 'hash'].includes(parts[0])) return true;
  return false;
}

function isStateName(name: string): boolean {
  if (segs(name).some(s => s === 'state' || s === 'province')) return true;
  const lower = name.toLowerCase();
  return lower.includes('statecode') || lower.includes('statename') || lower.includes('usstate');
}

function isCountryName(name: string): boolean {
  if (segs(name).some(s => s === 'country' || s === 'nation')) return true;
  const lower = name.toLowerCase();
  return lower.includes('isocode') || lower.includes('countrycode') || lower.includes('countryname');
}

function isDateName(name: string): boolean {
  const lower = name.toLowerCase();
  if (DATE_WHOLE_PATTERN.test(lower)) return true;
  if (segs(name).some(s => DATE_SEGMENT_PATTERN.test(s))) return true;
  return /_at$|_date$|_time$|_ts$|_dt$|_month$|_year$|_day$|_week$|_quarter$/i.test(name);
}

// ── Sample-value helpers ─────────────────────────────────────────────────────

function isNumericSample(v: unknown): boolean {
  if (typeof v === 'number') return !isNaN(v);
  if (typeof v === 'string' && v !== '') return !isNaN(Number(v));
  return false;
}

function isDateString(v: unknown): boolean {
  const s = String(v);
  return /^\d{4}-\d{2}(-\d{2})?/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);
}

function samplesMatchStates(samples: unknown[]): boolean {
  const nonNull = samples.filter(v => v != null).slice(0, 8);
  if (nonNull.length < 2) return false;
  const matched = nonNull.filter(v => US_STATE_VALUES.has(String(v).toLowerCase())).length;
  return matched / nonNull.length >= 0.6;
}

function samplesMatchCountries(samples: unknown[]): boolean {
  const nonNull = samples.filter(v => v != null).slice(0, 8);
  if (nonNull.length < 2) return false;
  const matched = nonNull.filter(v => ISO_COUNTRY_CODES.has(String(v).toLowerCase())).length;
  return matched / nonNull.length >= 0.6;
}

function samplesAreNumeric(samples: unknown[]): boolean {
  const nonNull = samples.filter(v => v != null).slice(0, 10);
  if (nonNull.length === 0) return false;
  return nonNull.filter(isNumericSample).length / nonNull.length >= 0.8;
}

function samplesAreDates(samples: unknown[]): boolean {
  const strings = samples.filter(v => v != null && typeof v === 'string').slice(0, 6);
  if (strings.length === 0) return false;
  return strings.every(isDateString);
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Classifies each column in a query result into a ColumnRole.
 *
 * @param columns     - Column names from QueryResult.columns
 * @param rows        - Row data from QueryResult.rows
 * @param columnTypes - Optional BigQuery type strings (e.g. 'FLOAT64', 'DATE')
 * @param sampleSize  - Number of rows to sample for value-based inference (default 10)
 */
export function classifyColumns(
  columns: string[],
  rows: unknown[][],
  columnTypes?: string[],
  sampleSize = 10,
): ColumnRole[] {
  return columns.map((col, i) => {
    const bqType = columnTypes?.[i]?.toUpperCase();
    const samples = rows.slice(0, sampleSize).map(r => (r as unknown[])[i]);

    // Layer 1: Authoritative BQ type
    if (bqType && BQ_DATE_TYPES.has(bqType)) return 'date';

    // Layer 2: Name patterns (underscore-segment aware)
    if (isIdName(col)) return 'id';
    if (isLatName(col)) return 'geo-lat';
    if (isLngName(col)) return 'geo-lng';
    if (isDateName(col)) return 'date';
    if (isStateName(col)) return 'geo-state';
    if (isCountryName(col)) return 'geo-country';

    // BQ numeric type (after name checks so IDs are caught first)
    if (bqType && BQ_NUMERIC_TYPES.has(bqType)) return 'measure';

    // Layer 3: Sample value analysis
    const nonNull = samples.filter(v => v != null);
    if (nonNull.length === 0) return 'unknown';

    if (samplesAreDates(nonNull)) return 'date';
    if (samplesAreNumeric(nonNull)) return 'measure';
    if (samplesMatchStates(nonNull)) return 'geo-state';
    if (samplesMatchCountries(nonNull)) return 'geo-country';

    // Cardinality heuristic: high-cardinality strings are free text, low-cardinality are labels
    const unique = new Set(nonNull.map(String)).size;
    if (nonNull.length >= 5 && unique / nonNull.length > 0.8) return 'text';

    return 'label';
  });
}

/**
 * Returns the column name for a given role, or null if not present.
 */
export function findRoleColumn(
  columns: string[],
  roles: ColumnRole[],
  role: ColumnRole,
): string | null {
  const idx = roles.indexOf(role);
  return idx === -1 ? null : columns[idx];
}

/**
 * Returns all column names matching a given role.
 */
export function findRoleColumns(
  columns: string[],
  roles: ColumnRole[],
  role: ColumnRole,
): string[] {
  return columns.filter((_, i) => roles[i] === role);
}
