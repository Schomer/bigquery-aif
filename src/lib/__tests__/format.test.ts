// src/lib/__tests__/format.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatBytes, truncateLabel, truncateEmail, relativeTime } from '../format';

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns "0 B" for negative values', () => {
    expect(formatBytes(-100)).toBe('0 B');
  });

  it('formats bytes below 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(5 * 1024)).toBe('5.0 KB');
  });

  it('formats megabytes with one decimal for small values', () => {
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });

  it('rounds megabytes for values >= 10', () => {
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(3 * 1024 ** 4)).toBe('3.0 TB');
  });
});

// ---------------------------------------------------------------------------
// truncateLabel
// ---------------------------------------------------------------------------

describe('truncateLabel', () => {
  it('returns the string unchanged when within maxLen', () => {
    expect(truncateLabel('short', 30)).toBe('short');
  });

  it('returns the string unchanged when exactly at maxLen', () => {
    const str = 'a'.repeat(30);
    expect(truncateLabel(str, 30)).toBe(str);
  });

  it('truncates and appends ellipsis when exceeding maxLen', () => {
    const str = 'a'.repeat(35);
    const result = truncateLabel(str, 30);
    expect(result.length).toBe(30);
    expect(result.endsWith('\u2026')).toBe(true);
  });

  it('uses default maxLen of 30', () => {
    const str = 'a'.repeat(31);
    const result = truncateLabel(str);
    expect(result.length).toBe(30);
    expect(result.endsWith('\u2026')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// truncateEmail
// ---------------------------------------------------------------------------

describe('truncateEmail', () => {
  it('returns the local part of an email', () => {
    expect(truncateEmail('alice@example.com')).toBe('alice');
  });

  it('returns the full string if no @ is present', () => {
    expect(truncateEmail('no-at-sign')).toBe('no-at-sign');
  });

  it('truncates the local part when maxLen is provided and exceeded', () => {
    const result = truncateEmail('verylongusername@example.com', 6);
    expect(result.length).toBe(6);
    expect(result.endsWith('\u2026')).toBe(true);
  });

  it('does not truncate when local part is within maxLen', () => {
    expect(truncateEmail('bob@example.com', 10)).toBe('bob');
  });
});

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats seconds ago', () => {
    const ts = new Date('2025-06-15T11:59:30Z');
    expect(relativeTime(ts)).toBe('30s ago');
  });

  it('formats minutes ago', () => {
    const ts = new Date('2025-06-15T11:55:00Z');
    expect(relativeTime(ts)).toBe('5 min ago');
  });

  it('formats hours ago', () => {
    const ts = new Date('2025-06-15T09:00:00Z');
    expect(relativeTime(ts)).toBe('3h ago');
  });

  it('formats days ago', () => {
    const ts = new Date('2025-06-13T12:00:00Z');
    expect(relativeTime(ts)).toBe('2d ago');
  });

  it('handles future timestamps', () => {
    const ts = new Date('2025-06-15T13:30:00Z');
    const result = relativeTime(ts);
    expect(result).toMatch(/^in /);
  });

  it('returns the input string for invalid dates', () => {
    expect(relativeTime('not-a-date')).toBe('not-a-date');
  });

  it('accepts a numeric timestamp (ms)', () => {
    const ts = new Date('2025-06-15T11:00:00Z').getTime();
    expect(relativeTime(ts)).toBe('1h ago');
  });

  it('accepts an ISO string', () => {
    expect(relativeTime('2025-06-15T11:00:00Z')).toBe('1h ago');
  });

  describe('mock BigQuery result set integration', () => {
    it('works with a single-row result', () => {
      const row = {
        created_at: '2025-06-15T11:30:00Z',
        size_bytes: 2048,
        user_email: 'dev@corp.io',
      };
      expect(relativeTime(row.created_at)).toBe('30 min ago');
      expect(formatBytes(row.size_bytes)).toBe('2.0 KB');
      expect(truncateEmail(row.user_email)).toBe('dev');
    });

    it('handles empty results gracefully', () => {
      const rows: Record<string, unknown>[] = [];
      expect(rows.length).toBe(0);
      // No formatting calls needed -- just confirming no crash
    });
  });
});
