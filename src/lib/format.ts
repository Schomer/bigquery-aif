// src/lib/format.ts
// Consolidated formatting utilities used across components.

/**
 * Format a byte count into a human-readable string.
 * Covers B through TB with adaptive precision.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  if (i === 0) return `${Math.round(val)} B`;
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/**
 * Truncate a string to maxLen characters, appending an ellipsis if needed.
 * Default maxLen is 30.
 */
export function truncateLabel(str: string, maxLen: number = 30): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, Math.max(0, maxLen - 1)) + '\u2026';
}

/**
 * Truncate an email address to just the local part (before @).
 * If maxLen is provided and the local part exceeds it, truncates with ellipsis.
 */
export function truncateEmail(email: string, maxLen?: number): string {
  const at = email.indexOf('@');
  const local = at > 0 ? email.slice(0, at) : email;
  if (maxLen != null && local.length > maxLen) {
    return local.slice(0, maxLen - 1) + '\u2026';
  }
  return local;
}

/**
 * Format a date/time value as a relative time string ("2h ago", "3d ago", etc.).
 */
export function relativeTime(dateStr: string | number | Date): string {
  try {
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts)) return String(dateStr) || '---';
    const diffMs = Date.now() - ts;
    if (diffMs < 0) {
      // Future timestamp: show "in X"
      const futureMs = -diffMs;
      const secs = Math.floor(futureMs / 1000);
      if (secs < 60) return 'in <1m';
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `in ${mins}m`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (hrs < 24) return remMins > 0 ? `in ${hrs}h ${remMins}m` : `in ${hrs}h`;
      return `in ${Math.floor(hrs / 24)}d`;
    }
    const secs = Math.floor(diffMs / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return String(dateStr) || '---';
  }
}
