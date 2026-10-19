/**
 * Escape a CSV cell and neutralise spreadsheet formula injection.
 * Text starting with = + - @ TAB or CR is prefixed with a quote so Excel/Sheets treat it as text.
 * Real numbers are written as-is so negative amounts stay numeric.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // BOM so Excel opens UTF-8 (names with accents) correctly; CRLF per RFC 4180
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
