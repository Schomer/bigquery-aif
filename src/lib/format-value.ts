// src/lib/format-value.ts
// Smart value formatting with currency-aware heuristics.

// Column name patterns that indicate monetary values.
// Matched case-insensitively against the full column name.
const CURRENCY_PATTERNS = /(?:^|_|\.)(sale|sales|revenue|price|cost|amount|spend|spending|income|profit|margin|budget|fee|fees|charge|charges|payment|payments|balance|gross|net|arpu|ltv|aov|gmv|total_usd|usd|earnings|proceeds|refund|refunds|discount|discounts|wage|wages|salary|salaries|commission|commissions|tax|taxes|debt|credit|debit|invoice|bill|rent|premium)(?:$|_|s$)/i;

// Patterns that, when present, disqualify a column from currency formatting
// even if it also matches a currency word (e.g., "cost_tier", "price_count").
const NON_CURRENCY_SUFFIXES = /(?:_count|_cnt|_id|_tier|_level|_rank|_index|_pct|_percent|_ratio|_rate|_bytes|_rows|_num|_flag|_code|_type|_status|_version|_qty|_quantity)$/i;

/**
 * Returns true if the column name suggests monetary values.
 */
export function isCurrencyColumn(columnName: string): boolean {
  if (NON_CURRENCY_SUFFIXES.test(columnName)) return false;
  return CURRENCY_PATTERNS.test(columnName);
}

/**
 * Format a value for display, with currency awareness based on column name.
 * Handles both number and string inputs (BigQuery often returns numbers as strings).
 */
export function formatDisplayValue(value: unknown, columnName: string): string {
  if (value === null || value === undefined) return '\u2014';

  const num = typeof value === 'number' ? value : Number(value);
  if (typeof value !== 'number' && isNaN(num)) {
    return String(value);
  }

  if (isCurrencyColumn(columnName)) {
    return formatCurrency(num);
  }

  return formatPlainNumber(num);
}

/**
 * Format a number as compact notation with optional currency prefix.
 * Used for chart axes and limited-space displays.
 * Examples: "$509.4M", "$1.2B", "12.5K"
 */
export function formatCompactValue(value: number, columnName: string): string {
  const prefix = isCurrencyColumn(columnName) ? '$' : '';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const v = abs / 1_000_000_000;
    return `${sign}${prefix}${stripTrailingZeros(v, 1)}B`;
  }
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${prefix}${stripTrailingZeros(v, 1)}M`;
  }
  if (abs >= 1_000) {
    const v = abs / 1_000;
    return `${sign}${prefix}${stripTrailingZeros(v, 1)}K`;
  }
  if (prefix) {
    return `${sign}${prefix}${formatCurrencyRaw(abs)}`;
  }
  return formatPlainNumber(value);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  // For large values (>= 1), no decimals. For small values, 2 decimal places.
  if (abs >= 1) {
    return `${sign}$${Math.round(abs).toLocaleString()}`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

function formatCurrencyRaw(abs: number): string {
  if (abs >= 1) {
    return Math.round(abs).toLocaleString();
  }
  return abs.toFixed(2);
}

function formatPlainNumber(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString();
  // For decimals, use up to 2 decimal places
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function stripTrailingZeros(value: number, minDecimals: number): string {
  const fixed = value.toFixed(minDecimals);
  // Remove trailing zeros after decimal point, but keep at least minDecimals
  if (fixed.includes('.')) {
    const trimmed = fixed.replace(/0+$/, '');
    if (trimmed.endsWith('.')) return trimmed.slice(0, -1);
    return trimmed;
  }
  return fixed;
}
