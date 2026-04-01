/**
 * Centralized column detection utilities for CSV data.
 * Consolidates duplicate implementations from metricsCalculator and insightsAnalytics.
 */

import type { CSVRow } from './csvParser';

// ============ Common Column Patterns ============

/**
 * Common column name patterns for different data types.
 * Used as defaults when detecting columns.
 */
export const COLUMN_PATTERNS = {
  // Agent/Owner columns
  owner: ['gtt owner', 'owner name', 'agent', 'last gtt action by', 'lead owner'],

  // Date columns
  createdDate: ['created date', 'trip: created date', 'date'],
  passthroughDate: ['passthrough to sales date', 'passthrough date'],
  hotPassDate: ['created date', 'enquiry date', 'trip created', 'date'],
  quoteDate: ['quote first sent', 'first sent date', 'created date', 'date'],

  // Location columns
  region: ['destination', 'region', 'country', 'original interest'],
  program: ['us program', 'program', 'department', 'team', 'business unit'],

  // Segment columns
  repeatNew: ['repeat/new', 'repeat', 'client type', 'customer type'],
  b2b: ['b2b/b2c', 'b2b', 'business type', 'client category', 'lead channel'],

  // Status/reason columns
  nonValidatedReason: ['non validated reason', 'reason', 'non-validated reason'],
} as const;

// ============ Main Functions ============

/**
 * Find a column in a CSV row by matching against possible name patterns.
 * Returns the actual column name found, or null if no match.
 *
 * @param row - A sample row to search for column names
 * @param patterns - Array of possible column name patterns (case-insensitive)
 * @returns The matching column name or null
 */
export const findColumn = (row: CSVRow | undefined | null, patterns: readonly string[]): string | null => {
  if (!row) return null;

  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const found = keys.find((k) => k.toLowerCase().includes(pattern.toLowerCase()));
    if (found) return found;
  }
  return null;
};

/**
 * Find multiple columns at once.
 * Returns an object mapping pattern keys to found column names.
 *
 * @param row - A sample row to search for column names
 * @param patternMap - Object mapping keys to arrays of possible patterns
 * @returns Object with same keys, values are found column names or null
 */
export const findColumns = <T extends Record<string, string[]>>(
  row: CSVRow | undefined | null,
  patternMap: T
): { [K in keyof T]: string | null } => {
  const result = {} as { [K in keyof T]: string | null };

  for (const key of Object.keys(patternMap) as (keyof T)[]) {
    result[key] = findColumn(row, patternMap[key]);
  }

  return result;
};

/**
 * Get the value of a column by trying multiple possible column names.
 * Useful when column naming varies between data sources.
 *
 * @param row - The row to get value from
 * @param patterns - Array of possible column names
 * @returns The value or empty string if not found
 */
export const getColumnValue = (row: CSVRow | undefined | null, patterns: string[]): string => {
  if (!row) return '';

  const column = findColumn(row, patterns);
  return column ? (row[column] || '').trim() : '';
};

/**
 * Check if a row has a specific column (by pattern matching).
 */
export const hasColumn = (row: CSVRow | undefined | null, patterns: string[]): boolean => {
  return findColumn(row, patterns) !== null;
};

/**
 * Get all values from a specific column across multiple rows.
 */
export const getColumnValues = (rows: CSVRow[], patterns: string[]): string[] => {
  if (rows.length === 0) return [];

  const column = findColumn(rows[0], patterns);
  if (!column) return [];

  return rows.map((row) => (row[column] || '').trim()).filter(Boolean);
};

// ============ Segment Filter Functions ============

export type ChannelFilter = 'all' | 'b2b' | 'b2c';
export type ClientTypeFilter = 'all' | 'repeat' | 'prospect';

/**
 * Filter rows by B2B/B2C channel.
 * Returns original array when filter is 'all' or column is absent.
 */
export const filterByChannel = (rows: CSVRow[], filter: ChannelFilter): CSVRow[] => {
  if (filter === 'all' || rows.length === 0) return rows;

  const col = findColumn(rows[0], [...COLUMN_PATTERNS.b2b]);
  if (!col) return rows;

  return rows.filter((row) => {
    const val = (row[col] || '').toString().toLowerCase().trim();
    const isB2b = val === 'b2b' || val.includes('b2b') || val === 'business';
    return filter === 'b2b' ? isB2b : !isB2b;
  });
};

/**
 * Filter rows by Repeat/Prospect client type.
 * Returns original array when filter is 'all' or column is absent.
 */
export const filterByClientType = (rows: CSVRow[], filter: ClientTypeFilter): CSVRow[] => {
  if (filter === 'all' || rows.length === 0) return rows;

  const col = findColumn(rows[0], [...COLUMN_PATTERNS.repeatNew]);
  if (!col) return rows;

  return rows.filter((row) => {
    const val = (row[col] || '').toString().toLowerCase().trim();
    const isRepeat = val === 'repeat' || val === 'returning' || val === 'existing';
    return filter === 'repeat' ? isRepeat : !isRepeat;
  });
};
