/**
 * Centralized date parsing utilities for Excel and standard date formats.
 * Consolidates duplicate implementations from metricsCalculator, insightsAnalytics, App, and recordsTracker.
 */

// ============ Constants ============

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_SLOTS = [
  { name: 'Early Morning (6-9am)', start: 6, end: 9 },
  { name: 'Morning (9am-12pm)', start: 9, end: 12 },
  { name: 'Afternoon (12-3pm)', start: 12, end: 15 },
  { name: 'Late Afternoon (3-6pm)', start: 15, end: 18 },
  { name: 'Evening (6-9pm)', start: 18, end: 21 },
  { name: 'Night (9pm-6am)', start: 21, end: 6 },
];

// Excel epoch: December 30, 1899
const EXCEL_EPOCH = new Date(1899, 11, 30);

// ============ Types ============

export interface ParsedDateTime {
  date: Date;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  hour: number;
  timeSlot: string; // "Morning", "Afternoon", etc.
}

// ============ Helper Functions ============

const getTimeSlot = (hour: number): string => {
  for (const slot of TIME_SLOTS) {
    if (slot.start < slot.end) {
      if (hour >= slot.start && hour < slot.end) return slot.name;
    } else {
      // Night wraps around
      if (hour >= slot.start || hour < slot.end) return slot.name;
    }
  }
  return 'Unknown';
};

/**
 * Parse Excel serial number to JavaScript Date
 */
const parseExcelSerial = (value: number): Date | null => {
  if (value <= 1000 || value >= 100000) return null;
  const jsDate = new Date(EXCEL_EPOCH.getTime() + value * 24 * 60 * 60 * 1000);
  return isNaN(jsDate.getTime()) ? null : jsDate;
};

// ============ Main Exports ============

/**
 * Parse a date string or Excel serial number to Date object.
 * Returns null if parsing fails.
 */
export const parseDate = (value: string | number | null | undefined): Date | null => {
  if (value === null || value === undefined) return null;

  const strValue = String(value).trim();
  if (strValue === '') return null;

  // Try Excel serial number
  const numValue = parseFloat(strValue);
  if (!isNaN(numValue)) {
    const excelDate = parseExcelSerial(numValue);
    if (excelDate) return excelDate;
  }

  // Try standard date string
  const parsed = new Date(strValue);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
};

// Regex for ISO date format YYYY-MM-DD (with optional time portion)
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
// Regex for common US date formats: M/D/YYYY or MM/DD/YYYY (with optional time)
const US_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;

/**
 * Format a date to YYYY-MM-DD string.
 * Returns null if date is invalid.
 *
 * IMPORTANT: Avoids timezone drift by extracting date components directly
 * from the string when possible, rather than going through new Date() which
 * treats ISO strings as UTC but getFullYear/getMonth/getDate as local time.
 */
export const formatDateString = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  const strValue = String(value).trim();
  if (strValue === '') return null;

  // Fast path: if already YYYY-MM-DD, extract directly (avoids timezone issues)
  const isoMatch = strValue.match(ISO_DATE_RE);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2];
    const d = isoMatch[3];
    // Validate the components are reasonable
    const mi = parseInt(m, 10);
    const di = parseInt(d, 10);
    if (mi >= 1 && mi <= 12 && di >= 1 && di <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // Fast path: US format M/D/YYYY — extract directly
  const usMatch = strValue.match(US_DATE_RE);
  if (usMatch) {
    const m = parseInt(usMatch[1], 10);
    const d = parseInt(usMatch[2], 10);
    const y = usMatch[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Fallback: parse through Date object using UTC to avoid timezone drift
  const date = parseDate(value);
  if (!date) return null;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a date/time value with extended information (day of week, time slot, etc.)
 * Used for timing analysis.
 */
export const parseDateTime = (value: string | number | null | undefined): ParsedDateTime | null => {
  const date = parseDate(value);
  if (!date) return null;

  return {
    date,
    dayOfWeek: date.getDay(),
    dayName: DAY_NAMES[date.getDay()],
    hour: date.getHours(),
    timeSlot: getTimeSlot(date.getHours()),
  };
};

/**
 * Check if a date falls within a date range.
 */
export const isDateInRange = (
  dateValue: string | number | null | undefined,
  startDate: Date | null,
  endDate: Date | null
): boolean => {
  const date = parseDate(dateValue);
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
};

/**
 * Get the start and end dates for common timeframe options.
 */
export const getTimeframeDates = (
  timeframe: 'lastWeek' | 'thisMonth' | 'lastMonth' | 'monthBeforeLast' | 'thisQuarter' | 'lastQuarter' | 'quarterBeforeLast' | 'lastYear' | 'all'
): { start: Date | null; end: Date | null } => {
  if (timeframe === 'all') {
    return { start: null, end: null };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  let start: Date;
  let end: Date;

  switch (timeframe) {
    case 'lastWeek': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start = new Date(today);
      start.setDate(today.getDate() - 7);
      end = today;
      break;
    }
    case 'thisMonth': {
      start = new Date(currentYear, currentMonth, 1);
      end = new Date(currentYear, currentMonth + 1, 0);
      break;
    }
    case 'lastMonth': {
      start = new Date(currentYear, currentMonth - 1, 1);
      end = new Date(currentYear, currentMonth, 0);
      break;
    }
    case 'thisQuarter': {
      start = new Date(currentYear, currentQuarter * 3, 1);
      end = new Date(currentYear, currentQuarter * 3 + 3, 0);
      break;
    }
    case 'lastQuarter': {
      const lastQuarter = currentQuarter - 1;
      const year = lastQuarter < 0 ? currentYear - 1 : currentYear;
      const quarter = lastQuarter < 0 ? 3 : lastQuarter;
      start = new Date(year, quarter * 3, 1);
      end = new Date(year, quarter * 3 + 3, 0);
      break;
    }
    case 'monthBeforeLast': {
      start = new Date(currentYear, currentMonth - 2, 1);
      end = new Date(currentYear, currentMonth - 1, 0);
      break;
    }
    case 'quarterBeforeLast': {
      const twoQuartersAgo = currentQuarter - 2;
      const qblQuarter = ((twoQuartersAgo % 4) + 4) % 4;
      const qblYear = twoQuartersAgo < 0 ? currentYear - 1 : currentYear;
      start = new Date(qblYear, qblQuarter * 3, 1);
      end = new Date(qblYear, qblQuarter * 3 + 3, 0);
      break;
    }
    case 'lastYear': {
      start = new Date(currentYear - 1, 0, 1);
      end = new Date(currentYear - 1, 11, 31);
      break;
    }
    default:
      return { start: null, end: null };
  }

  return { start, end };
};

export { DAY_NAMES, TIME_SLOTS };
