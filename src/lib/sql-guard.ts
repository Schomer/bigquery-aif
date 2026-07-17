// src/lib/sql-guard.ts
// Lightweight pre-execution guard: checks WHERE clause literal types
// against known column types and auto-corrects common mismatches.

import { escapeRegExp } from './regex-utils';

export interface TypeMismatch {
  column: string;
  expectedType: string;
  literalValue: string;
}

export function checkAndFixTypes(
  sql: string,
  schema: { name: string; type: string }[]
): { sql: string; fixes: TypeMismatch[] } {
  const fixes: TypeMismatch[] = [];
  let fixedSql = sql;

  for (const col of schema) {
    // INT64/FLOAT64/NUMERIC column compared with string literal: WHERE year = '2023'
    if (['INT64', 'INTEGER', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(col.type)) {
      const pattern = new RegExp(
        `\\b${escapeRegExp(col.name)}\\b\\s*=\\s*'(\\d+\\.?\\d*)'`, 'gi'
      );
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(fixedSql)) !== null) {
        fixedSql = fixedSql.replace(match[0], `${col.name} = ${match[1]}`);
        fixes.push({ column: col.name, expectedType: col.type, literalValue: match[1] });
      }
    }

    // BOOL column compared with string: WHERE active = 'TRUE'
    if (col.type === 'BOOL' || col.type === 'BOOLEAN') {
      const pattern = new RegExp(
        `\\b${escapeRegExp(col.name)}\\b\\s*=\\s*'(TRUE|FALSE)'`, 'gi'
      );
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(fixedSql)) !== null) {
        fixedSql = fixedSql.replace(match[0], `${col.name} = ${match[1].toUpperCase()}`);
        fixes.push({ column: col.name, expectedType: col.type, literalValue: match[1] });
      }
    }
  }

  return { sql: fixedSql, fixes };
}
