// src/lib/__tests__/sql-guard.test.ts
// Unit tests for checkAndFixTypes: verifies that the SQL guard correctly
// detects and fixes type mismatches in WHERE clauses.

import { describe, it, expect } from 'vitest';
import { checkAndFixTypes } from '../sql-guard';

describe('checkAndFixTypes', () => {
  // -- Normal column name with numeric type vs string literal --

  it('fixes a normal column name with string literal for INT64', () => {
    const sql = "SELECT * FROM t WHERE year = '2023'";
    const schema = [{ name: 'year', type: 'INT64' }];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe('SELECT * FROM t WHERE year = 2023');
    expect(result.fixes).toHaveLength(1);
    expect(result.fixes[0]).toEqual({
      column: 'year',
      expectedType: 'INT64',
      literalValue: '2023',
    });
  });

  // -- Column name containing $ --

  it('fixes a column with $ in its name (price$usd)', () => {
    // escapeRegExp must handle the $ metacharacter so the regex
    // matches the literal column name.
    const sql = "SELECT * FROM t WHERE price$usd = '100'";
    const schema = [{ name: 'price$usd', type: 'INT64' }];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe('SELECT * FROM t WHERE price$usd = 100');
    expect(result.fixes).toHaveLength(1);
    expect(result.fixes[0].column).toBe('price$usd');
  });

  it('cannot fix count(*) -- word boundary limitation with special characters', () => {
    // escapeRegExp correctly escapes ( ) *, but \b word boundary anchors
    // only match at word-char / non-word-char transitions. Since "count"
    // is followed by "(", and ")" is followed by a space, the \b before
    // "count" works but the \b after ")" does not reliably match in all
    // engines. The resulting regex \bcount\(\*\)\b fails to find the
    // column in the SQL, so the guard returns it unchanged.
    const sql = "SELECT * FROM t WHERE count(*) = '5'";
    const schema = [{ name: 'count(*)', type: 'INT64' }];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe("SELECT * FROM t WHERE count(*) = '5'");
    expect(result.fixes).toHaveLength(0);
  });


  // -- Boolean column fix --

  it('removes quotes around boolean literals for BOOL columns', () => {
    const sql = "SELECT * FROM t WHERE active = 'TRUE'";
    const schema = [{ name: 'active', type: 'BOOL' }];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe('SELECT * FROM t WHERE active = TRUE');
    expect(result.fixes).toHaveLength(1);
    expect(result.fixes[0]).toEqual({
      column: 'active',
      expectedType: 'BOOL',
      literalValue: 'TRUE',
    });
  });

  it('handles BOOLEAN type alias the same as BOOL', () => {
    const sql = "SELECT * FROM t WHERE is_active = 'FALSE'";
    const schema = [{ name: 'is_active', type: 'BOOLEAN' }];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe('SELECT * FROM t WHERE is_active = FALSE');
    expect(result.fixes).toHaveLength(1);
  });

  // -- No false positive on unrelated columns --

  it('does not modify columns not in the schema', () => {
    const sql = "SELECT * FROM t WHERE name = 'Alice' AND year = '2023'";
    // Only year is in the schema; name should be left alone.
    const schema = [{ name: 'year', type: 'INT64' }];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe("SELECT * FROM t WHERE name = 'Alice' AND year = 2023");
    expect(result.fixes).toHaveLength(1);
  });

  // -- String literal false positive (known limitation) --

  it('KNOWN LIMITATION: modifies numeric literal inside a string value that contains column name', () => {
    // When a column named "year" exists with type INT64, and the SQL
    // contains `WHERE note = "year = '2023'"`, the regex will match
    // `year = '2023'` inside the string literal and "fix" it.
    //
    // This is a known limitation: the guard uses regex pattern matching,
    // not a proper SQL parser, so it cannot distinguish between a WHERE
    // condition and a string literal that happens to look like one.
    const sql = `SELECT * FROM t WHERE note = "year = '2023'"`;
    const schema = [{ name: 'year', type: 'INT64' }];
    const result = checkAndFixTypes(sql, schema);

    // The guard WILL modify this -- documenting the false positive.
    expect(result.fixes.length).toBeGreaterThan(0);
  });

  // -- No changes when types already match --

  it('returns unchanged SQL when no type mismatches exist', () => {
    const sql = 'SELECT * FROM t WHERE year = 2023';
    const schema = [{ name: 'year', type: 'INT64' }];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe(sql);
    expect(result.fixes).toHaveLength(0);
  });

  // -- Multiple fixes in one query --

  it('fixes multiple type mismatches in the same query', () => {
    const sql = "SELECT * FROM t WHERE year = '2023' AND month = '12'";
    const schema = [
      { name: 'year', type: 'INT64' },
      { name: 'month', type: 'INT64' },
    ];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe('SELECT * FROM t WHERE year = 2023 AND month = 12');
    expect(result.fixes).toHaveLength(2);
  });

  // -- FLOAT64 type --

  it('fixes FLOAT64 column with quoted decimal literal', () => {
    const sql = "SELECT * FROM t WHERE price = '19.99'";
    const schema = [{ name: 'price', type: 'FLOAT64' }];
    const result = checkAndFixTypes(sql, schema);

    expect(result.sql).toBe('SELECT * FROM t WHERE price = 19.99');
    expect(result.fixes).toHaveLength(1);
    expect(result.fixes[0].expectedType).toBe('FLOAT64');
  });
});
