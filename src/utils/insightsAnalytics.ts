import type { CSVRow } from './csvParser';
import type { RawParsedData } from './indexedDB';
import Anthropic from '@anthropic-ai/sdk';
import { parseDateTime as parseDateTimeUtil, parseDate as parseDateUtil, formatDateString as formatDateStringUtil, DAY_NAMES, TIME_SLOTS, getTimeframeDates } from './dateParser';
import { findColumn as findColumnUtil } from './columnDetection';

// ============ US Program to Destination Mapping ============

export const PROGRAM_DESTINATION_MAP: Record<string, string[]> = {
  'WEMEA': [
    // Africa
    'Botswana', 'Kenya', 'Madagascar', 'Mauritius', 'Malawi', 'Morocco',
    'Mozambique', 'Namibia', 'Rwanda', 'Seychelles', 'South Africa',
    'Tanzania', 'Uganda', 'Zambia', 'Zimbabwe',
    // Middle East & Europe
    'Dubai', 'Egypt', 'England', 'Wales', 'Iceland', 'Ireland',
    'Israel', 'Jordan', 'Oman', 'Portugal', 'Scotland', 'Spain'
  ],
  'ASIA': [
    'Bhutan', 'Borneo', 'Myanmar', 'Cambodia', 'China', 'Indonesia',
    'Japan', 'Laos', 'Malaysia', 'Maldives', 'Nepal', 'Southern India',
    'India', 'Philippines', 'Russia', 'Singapore', 'South Korea',
    'Uzbekistan', 'Kyrgyzstan', 'Sri Lanka', 'Thailand', 'Vietnam',
    'Wildlife India'
  ],
  'CANAL': [
    // Pacific
    'Australia', 'Cook Islands', 'Fiji', 'French Polynesia', 'New Zealand', 'Samoa',
    // Americas
    'Antarctica', 'Arctic', 'Argentina', 'Belize', 'Bolivia', 'Brazil',
    'Caribbean', 'Chile', 'Colombia', 'Costa Rica', 'Ecuador', 'Guatemala',
    'Panama', 'Mexico', 'Peru', 'Uruguay',
    // USA & Canada
    'California', 'Alaska', 'Southwest & Rockies', 'Deep South',
    'New England', 'Hawaii', 'Pacific Northwest', 'Canada', 'The USA'
  ],
  'ESE': [
    'Austria', 'Budapest', 'Slovenia', 'Montenegro', 'Bosnia', 'Croatia',
    'France', 'Germany', 'Greece', 'Italy', 'Prague', 'Belgium',
    'Benelux', 'Luxembourg', 'Netherlands', 'Switzerland', 'Norway',
    'Sweden', 'Denmark', 'Scandinavia', 'Scandanavia', 'Turkey'
  ]
};

// Combined program pairs for Champ meetings
export const COMBINED_PROGRAMS: Record<string, string[]> = {
  'CANAL & ASIA': [...PROGRAM_DESTINATION_MAP['CANAL'], ...PROGRAM_DESTINATION_MAP['ASIA']],
  'ESE & WEMEA': [...PROGRAM_DESTINATION_MAP['ESE'], ...PROGRAM_DESTINATION_MAP['WEMEA']],
};

// Create reverse lookup: destination -> program
export const DESTINATION_TO_PROGRAM: Record<string, string> = {};
for (const [program, destinations] of Object.entries(PROGRAM_DESTINATION_MAP)) {
  for (const dest of destinations) {
    DESTINATION_TO_PROGRAM[dest.toLowerCase()] = program;
  }
}

// ============ Sub-Region Groupings within each Program ============

export const SUBREGION_MAP: Record<string, Record<string, string[]>> = {
  CANAL: {
    'North America': ['California', 'Alaska', 'Southwest & Rockies', 'Deep South', 'New England', 'Hawaii', 'Pacific Northwest', 'Canada', 'The USA'],
    'Latin America': ['Antarctica', 'Arctic', 'Argentina', 'Belize', 'Bolivia', 'Brazil', 'Caribbean', 'Chile', 'Colombia', 'Costa Rica', 'Ecuador', 'Guatemala', 'Panama', 'Mexico', 'Peru', 'Uruguay'],
    'Pacific': ['Australia', 'Cook Islands', 'Fiji', 'French Polynesia', 'New Zealand', 'Samoa'],
  },
  WEMEA: {
    'Africa': ['Botswana', 'Kenya', 'Madagascar', 'Mauritius', 'Malawi', 'Morocco', 'Mozambique', 'Namibia', 'Rwanda', 'Seychelles', 'South Africa', 'Tanzania', 'Uganda', 'Zambia', 'Zimbabwe'],
    'Middle East & Europe': ['Dubai', 'Egypt', 'England', 'Wales', 'Iceland', 'Ireland', 'Israel', 'Jordan', 'Oman', 'Portugal', 'Scotland', 'Spain'],
  },
  ESE: {
    'Western Europe': ['Austria', 'France', 'Germany', 'Greece', 'Italy', 'Belgium', 'Benelux', 'Luxembourg', 'Netherlands', 'Switzerland'],
    'Northern Europe': ['Norway', 'Sweden', 'Denmark', 'Scandinavia', 'Scandanavia'],
    'Eastern Europe': ['Budapest', 'Slovenia', 'Montenegro', 'Bosnia', 'Croatia', 'Prague', 'Turkey'],
  },
  ASIA: {
    'South Asia': ['Bhutan', 'Nepal', 'Southern India', 'India', 'Wildlife India', 'Sri Lanka', 'Maldives'],
    'Southeast Asia': ['Borneo', 'Myanmar', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Philippines', 'Singapore', 'Thailand', 'Vietnam'],
    'East Asia': ['China', 'Japan', 'South Korea', 'Russia', 'Uzbekistan', 'Kyrgyzstan'],
  },
};

// Create reverse lookup: destination -> sub-region name
export const DESTINATION_TO_SUBREGION: Record<string, string> = {};
for (const subregions of Object.values(SUBREGION_MAP)) {
  for (const [subregion, destinations] of Object.entries(subregions)) {
    for (const dest of destinations) {
      DESTINATION_TO_SUBREGION[dest.toLowerCase()] = subregion;
    }
  }
}

// Note: Debug console logs have been removed for production use

// Get the correct program for a destination
export const getProgramForDestination = (destination: string): string | null => {
  const normalized = destination.trim().toLowerCase();
  return DESTINATION_TO_PROGRAM[normalized] || null;
};

// Check if a destination belongs to a program
export const destinationBelongsToProgram = (destination: string, program: string): boolean => {
  const destProgram = getProgramForDestination(destination);
  return destProgram?.toLowerCase() === program.toLowerCase();
};

// ============ Date/Time Parsing & Column Detection ============
// Using centralized utilities from dateParser.ts and columnDetection.ts

const parseDateTime = parseDateTimeUtil;
const parseDate = parseDateUtil;
const findColumn = findColumnUtil;

// ============ Analysis Types ============

export interface DayAnalysis {
  day: string;
  count: number;
  percentage: number;
  avgPerDay: number;
}

export interface TimeAnalysis {
  timeSlot: string;
  count: number;
  percentage: number;
}

export interface NonValidatedReason {
  reason: string;
  count: number;
  percentage: number;
}

export interface AgentNonValidated {
  agentName: string;
  total: number;
  topReasons: NonValidatedReason[];
}

export interface BookingCorrelation {
  factor: string;
  bookedCount: number;
  notBookedCount: number;
  bookingRate: number;
  description: string;
}

export type RegionalTimeframe = 'lastWeek' | 'thisMonth' | 'lastMonth' | 'monthBeforeLast' | 'thisQuarter' | 'lastQuarter' | 'quarterBeforeLast' | 'lastYear' | 'all';

export type MeetingTimeframePair = 'thisQuarter' | 'thisMonth' | 'lastMonth' | 'lastQuarter';

export const MEETING_TIMEFRAME_OPTIONS: { value: MeetingTimeframePair; label: string; prevLabel: string }[] = [
  { value: 'thisQuarter', label: 'This Quarter', prevLabel: 'Last Quarter' },
  { value: 'thisMonth', label: 'This Month', prevLabel: 'Last Month' },
  { value: 'lastMonth', label: 'Last Month', prevLabel: 'Month Before' },
  { value: 'lastQuarter', label: 'Last Quarter', prevLabel: 'Quarter Before' },
];

export const getPreviousTimeframe = (current: MeetingTimeframePair): RegionalTimeframe => {
  switch (current) {
    case 'thisQuarter': return 'lastQuarter';
    case 'thisMonth': return 'lastMonth';
    case 'lastMonth': return 'monthBeforeLast';
    case 'lastQuarter': return 'quarterBeforeLast';
  }
};

export interface RegionalPerformance {
  region: string;
  trips: number;
  passthroughs: number;
  tpRate: number;
  hotPasses: number;
  hotPassRate: number; // hot passes / passthroughs
  quotes: number;
  pqRate: number; // quotes / passthroughs (P>Q rate)
}

export interface RegionalDeviation {
  region: string;
  agentTpRate: number;
  departmentTpRate: number;
  deviation: number; // positive = above dept avg, negative = below
  agentTrips: number;
  agentPassthroughs: number;
  departmentTrips: number;
  // Impact score: combines deviation magnitude with volume
  // Higher score = bigger opportunity for improvement
  impactScore: number;
}

export interface AgentImprovementRecommendation {
  region: string;
  priority: 'high' | 'medium' | 'low';
  deviation: number;
  agentTrips: number;
  departmentTrips: number;
  agentTpRate: number;
  departmentTpRate: number;
  impactScore: number;
  reason: string;
}

export interface DepartmentImprovementRecommendation {
  region: string;
  priority: 'high' | 'medium' | 'low';
  tpRate: number;
  departmentAvgRate: number;
  deviation: number; // negative = below department avg
  trips: number;
  passthroughs: number;
  potentialGain: number; // additional passthroughs if matched dept avg
  impactScore: number;
  reason: string;
}

export interface AgentRegionalPerformance {
  agentName: string;
  topRegions: RegionalPerformance[];
  bottomRegions: RegionalPerformance[];
  totalTrips: number;
  totalPassthroughs: number;
  overallTpRate: number;
}

export interface AgentRegionalAnalysis {
  agentName: string;
  totalTrips: number;
  totalPassthroughs: number;
  overallTpRate: number;
  // Regions where agent outperforms department
  aboveAverage: RegionalDeviation[];
  // Regions where agent underperforms department
  belowAverage: RegionalDeviation[];
  // All regional deviations
  allDeviations: RegionalDeviation[];
  // Prioritized recommendations for improvement
  recommendations: AgentImprovementRecommendation[];
}

export interface DepartmentRegionalPerformance {
  topRegions: RegionalPerformance[];
  bottomRegions: RegionalPerformance[];
  allRegions: RegionalPerformance[];
  // Hot pass rankings by hot pass rate
  topHotPassRegions: RegionalPerformance[];
  bottomHotPassRegions: RegionalPerformance[];
  totalTrips: number;
  totalPassthroughs: number;
  totalHotPasses: number;
  totalQuotes: number;
  overallTpRate: number;
  overallHotPassRate: number;
  overallPqRate: number;
}

export interface RegionalTrendPoint {
  period: string;
  periodStart: Date;
  region: string;
  tpRate: number;
  trips: number;
  passthroughs: number;
}

export interface RegionalTrendData {
  periods: string[];
  topRegionsByPeriod: Map<string, RegionalPerformance[]>;
  allTrends: RegionalTrendPoint[];
}

// ============ Client Segment Analysis Types ============

export interface ClientSegmentPerformance {
  segment: string; // 'repeat' | 'new' for repeat analysis, 'b2b' | 'b2c' for B2B analysis
  trips: number;
  passthroughs: number;
  tpRate: number;
}

export interface DepartmentClientSegmentPerformance {
  segments: ClientSegmentPerformance[];
  totalTrips: number;
  totalPassthroughs: number;
  overallTpRate: number;
}

export interface AgentClientSegmentPerformance {
  agentName: string;
  segments: ClientSegmentPerformance[];
  totalTrips: number;
  totalPassthroughs: number;
  overallTpRate: number;
}

export interface InsightsData {
  // Passthrough patterns
  passthroughsByDay: DayAnalysis[];
  passthroughsByTime: TimeAnalysis[];
  bestPassthroughDay: string | null;
  bestPassthroughTime: string | null;

  // Hot pass patterns
  hotPassByDay: DayAnalysis[];
  hotPassByTime: TimeAnalysis[];
  bestHotPassDay: string | null;
  bestHotPassTime: string | null;
  hasHotPassTimeData: boolean;

  // Non-validated analysis
  topNonValidatedReasons: NonValidatedReason[];
  agentNonValidated: AgentNonValidated[];

  // Booking correlations
  bookingCorrelations: BookingCorrelation[];

  // Data availability
  hasTimeData: boolean;
  hasNonValidatedReasons: boolean;
  hasBookingData: boolean;

  // Raw stats for AI
  totalPassthroughs: number;
  totalNonValidated: number;
  totalBookings: number;
  totalHotPass: number;

  // Regional performance
  hasRegionalData: boolean;
  departmentRegionalPerformance: DepartmentRegionalPerformance | null;
  agentRegionalPerformance: AgentRegionalPerformance[];
  regionalTrends: RegionalTrendData | null;
}

// ============ Timeframe Filter Helper ============

/**
 * Filter CSV rows by timeframe based on date columns
 */
export const filterRowsByTimeframe = (
  rows: CSVRow[],
  timeframe: RegionalTimeframe,
  dateColumnNames: string[]
): CSVRow[] => {
  if (timeframe === 'all' || rows.length === 0) {
    return rows;
  }

  const { start: startDate, end: endDate } = getTimeframeDates(timeframe);
  if (!startDate || !endDate) {
    return rows;
  }

  const dateCol = findColumn(rows[0], dateColumnNames);
  if (!dateCol) {
    return rows;
  }

  return rows.filter(row => {
    const dateVal = row[dateCol];
    if (!dateVal) return false;

    const parsed = parseDate(dateVal);
    if (!parsed) return false;

    return parsed >= startDate && parsed <= endDate;
  });
};

// ============ Analysis Functions ============

export const analyzePassthroughsByDay = (passthroughs: CSVRow[]): DayAnalysis[] => {
  if (passthroughs.length === 0) return [];

  const dateCol = findColumn(passthroughs[0], [
    'passthrough to sales date', 'passthrough date', 'created date', 'date'
  ]);

  if (!dateCol) return [];

  const dayCounts: Record<string, number> = {};
  const dayOccurrences: Record<string, Set<string>> = {};

  for (const row of passthroughs) {
    const dt = parseDateTime(row[dateCol]);
    if (dt) {
      dayCounts[dt.dayName] = (dayCounts[dt.dayName] || 0) + 1;
      if (!dayOccurrences[dt.dayName]) dayOccurrences[dt.dayName] = new Set();
      dayOccurrences[dt.dayName].add(dt.date.toDateString());
    }
  }

  const total = Object.values(dayCounts).reduce((a, b) => a + b, 0);

  return DAY_NAMES.map(day => ({
    day,
    count: dayCounts[day] || 0,
    percentage: total > 0 ? ((dayCounts[day] || 0) / total) * 100 : 0,
    avgPerDay: dayOccurrences[day] ? (dayCounts[day] || 0) / dayOccurrences[day].size : 0,
  })).sort((a, b) => b.count - a.count);
};

export const analyzePassthroughsByTime = (passthroughs: CSVRow[]): TimeAnalysis[] => {
  if (passthroughs.length === 0) return [];

  const dateCol = findColumn(passthroughs[0], [
    'passthrough to sales date', 'passthrough date', 'created date', 'date'
  ]);

  if (!dateCol) return [];

  const timeCounts: Record<string, number> = {};
  let hasTimeData = false;

  for (const row of passthroughs) {
    const dt = parseDateTime(row[dateCol]);
    if (dt) {
      // Check if we have actual time data (not just midnight)
      if (dt.hour !== 0 || dt.date.getMinutes() !== 0) {
        hasTimeData = true;
      }
      timeCounts[dt.timeSlot] = (timeCounts[dt.timeSlot] || 0) + 1;
    }
  }

  if (!hasTimeData) return []; // All times are midnight, likely no time data

  const total = Object.values(timeCounts).reduce((a, b) => a + b, 0);

  return TIME_SLOTS.map(slot => ({
    timeSlot: slot.name,
    count: timeCounts[slot.name] || 0,
    percentage: total > 0 ? ((timeCounts[slot.name] || 0) / total) * 100 : 0,
  })).sort((a, b) => b.count - a.count);
};

export const analyzeHotPassByDay = (hotPass: CSVRow[]): DayAnalysis[] => {
  if (hotPass.length === 0) return [];

  const dateCol = findColumn(hotPass[0], [
    'created date', 'trip: created date', 'enquiry date', 'date'
  ]);

  if (!dateCol) return [];

  const dayCounts: Record<string, number> = {};
  const dayOccurrences: Record<string, Set<string>> = {};

  for (const row of hotPass) {
    const dt = parseDateTime(row[dateCol]);
    if (dt) {
      dayCounts[dt.dayName] = (dayCounts[dt.dayName] || 0) + 1;
      if (!dayOccurrences[dt.dayName]) dayOccurrences[dt.dayName] = new Set();
      dayOccurrences[dt.dayName].add(dt.date.toDateString());
    }
  }

  const total = Object.values(dayCounts).reduce((a, b) => a + b, 0);

  return DAY_NAMES.map(day => ({
    day,
    count: dayCounts[day] || 0,
    percentage: total > 0 ? ((dayCounts[day] || 0) / total) * 100 : 0,
    avgPerDay: dayOccurrences[day] ? (dayCounts[day] || 0) / dayOccurrences[day].size : 0,
  })).sort((a, b) => b.count - a.count);
};

export const analyzeHotPassByTime = (hotPass: CSVRow[]): TimeAnalysis[] => {
  if (hotPass.length === 0) return [];

  const dateCol = findColumn(hotPass[0], [
    'created date', 'trip: created date', 'enquiry date', 'date'
  ]);

  if (!dateCol) return [];

  const timeCounts: Record<string, number> = {};
  let hasTimeData = false;

  for (const row of hotPass) {
    const dt = parseDateTime(row[dateCol]);
    if (dt) {
      // Check if we have actual time data (not just midnight)
      if (dt.hour !== 0 || dt.date.getMinutes() !== 0) {
        hasTimeData = true;
      }
      timeCounts[dt.timeSlot] = (timeCounts[dt.timeSlot] || 0) + 1;
    }
  }

  if (!hasTimeData) return []; // All times are midnight, likely no time data

  const total = Object.values(timeCounts).reduce((a, b) => a + b, 0);

  return TIME_SLOTS.map(slot => ({
    timeSlot: slot.name,
    count: timeCounts[slot.name] || 0,
    percentage: total > 0 ? ((timeCounts[slot.name] || 0) / total) * 100 : 0,
  })).sort((a, b) => b.count - a.count);
};

export const analyzeNonValidatedReasons = (nonConverted: CSVRow[]): NonValidatedReason[] => {
  if (nonConverted.length === 0) return [];

  const reasonCol = findColumn(nonConverted[0], [
    'non validated reason', 'reason', 'non-validated reason', 'status reason'
  ]);

  if (!reasonCol) return [];

  const reasonCounts: Record<string, number> = {};

  for (const row of nonConverted) {
    const reason = (row[reasonCol] || '').trim();
    // Filter out empty, purely numeric, or very short values (likely not real reasons)
    if (reason && !/^\d+$/.test(reason) && reason.length > 1) {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }

  const total = Object.values(reasonCounts).reduce((a, b) => a + b, 0);

  return Object.entries(reasonCounts)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

export const analyzeNonValidatedByAgent = (nonConverted: CSVRow[]): AgentNonValidated[] => {
  if (nonConverted.length === 0) return [];

  const keys = Object.keys(nonConverted[0] || {});
  const agentCol = keys.find(k =>
    k.toLowerCase().includes('lead owner') ||
    k.toLowerCase().includes('agent') ||
    k.includes('_agent')
  );
  const reasonCol = findColumn(nonConverted[0], [
    'non validated reason', 'reason', 'non-validated reason', 'status reason'
  ]);

  if (!agentCol || !reasonCol) return [];

  const agentReasons: Record<string, Record<string, number>> = {};
  let currentAgent = '';

  for (const row of nonConverted) {
    const agent = (row[agentCol] || '').trim();
    if (agent && !/^\d+$/.test(agent)) currentAgent = agent;

    const reason = (row[reasonCol] || '').trim();
    // Filter out empty, purely numeric, or very short values
    if (currentAgent && reason && !/^\d+$/.test(reason) && reason.length > 1) {
      if (!agentReasons[currentAgent]) agentReasons[currentAgent] = {};
      agentReasons[currentAgent][reason] = (agentReasons[currentAgent][reason] || 0) + 1;
    }
  }

  return Object.entries(agentReasons)
    .map(([agentName, reasons]) => {
      const total = Object.values(reasons).reduce((a, b) => a + b, 0);
      const topReasons = Object.entries(reasons)
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return { agentName, total, topReasons };
    })
    .sort((a, b) => b.total - a.total);
};

// ============ Regional Performance Analysis ============

interface TimeframeRange {
  start: Date | null;
  end: Date | null;
}

const getTimeframeRange = (timeframe: RegionalTimeframe): TimeframeRange => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (timeframe) {
    case 'lastWeek': {
      // Last week: Sunday to Saturday of previous week
      const dayOfWeek = today.getDay();
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - dayOfWeek - 7);
      const lastSaturday = new Date(lastSunday);
      lastSaturday.setDate(lastSunday.getDate() + 6);
      lastSaturday.setHours(23, 59, 59, 999);
      return { start: lastSunday, end: lastSaturday };
    }
    case 'thisMonth': {
      // This month: 1st of current month to today
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: firstOfMonth, end: null };
    }
    case 'lastMonth': {
      // Last month: 1st to last day of previous month
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return { start: firstOfLastMonth, end: lastOfLastMonth };
    }
    case 'thisQuarter': {
      // This quarter: 1st of current quarter to today
      const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
      const firstOfQuarter = new Date(today.getFullYear(), quarterMonth, 1);
      return { start: firstOfQuarter, end: null };
    }
    case 'lastQuarter': {
      // Last quarter: full previous quarter
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const lastQuarterYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const firstOfLastQuarter = new Date(lastQuarterYear, lastQuarter * 3, 1);
      const lastOfLastQuarter = new Date(lastQuarterYear, (lastQuarter + 1) * 3, 0, 23, 59, 59, 999);
      return { start: firstOfLastQuarter, end: lastOfLastQuarter };
    }
    case 'monthBeforeLast': {
      // Month before last: 1st to last day of (current month - 2)
      const firstOfMBL = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const lastOfMBL = new Date(today.getFullYear(), today.getMonth() - 1, 0, 23, 59, 59, 999);
      return { start: firstOfMBL, end: lastOfMBL };
    }
    case 'quarterBeforeLast': {
      // Quarter before last: full quarter two quarters ago
      const currentQ = Math.floor(today.getMonth() / 3);
      const twoQuartersAgo = currentQ - 2;
      const qblQuarter = ((twoQuartersAgo % 4) + 4) % 4;
      const qblYear = twoQuartersAgo < 0 ? today.getFullYear() - 1 : today.getFullYear();
      const firstOfQBL = new Date(qblYear, qblQuarter * 3, 1);
      const lastOfQBL = new Date(qblYear, (qblQuarter + 1) * 3, 0, 23, 59, 59, 999);
      return { start: firstOfQBL, end: lastOfQBL };
    }
    case 'lastYear': {
      // Last year: Jan 1 to Dec 31 of previous year
      const lastYear = today.getFullYear() - 1;
      const firstOfLastYear = new Date(lastYear, 0, 1);
      const lastOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59, 999);
      return { start: firstOfLastYear, end: lastOfLastYear };
    }
    case 'all':
      return { start: null, end: null };
    default:
      return { start: null, end: null };
  }
};

/**
 * Check if a date string falls within a timeframe range.
 * Uses YYYY-MM-DD string comparison to avoid timezone drift issues
 * (e.g. new Date("2026-02-23") is UTC midnight, which is Feb 22 in US timezones).
 */
const fmtDateForCompare = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isWithinTimeframe = (dateStr: string, startDate: Date | null, endDate?: Date | null): boolean => {
  if (!startDate && !endDate) return true; // 'all' timeframe
  // Parse the CSV date to a YYYY-MM-DD string (timezone-safe)
  const rowDate = formatDateStringUtil(dateStr);
  if (!rowDate) return false;
  if (startDate && rowDate < fmtDateForCompare(startDate)) return false;
  if (endDate && rowDate > fmtDateForCompare(endDate)) return false;
  return true;
};

export const analyzeRegionalPerformance = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all',
  hotPassData: CSVRow[] = [],
  quotesData: CSVRow[] = [],
  passthroughsData: CSVRow[] = []
): DepartmentRegionalPerformance => {
  const emptyResult: DepartmentRegionalPerformance = {
    topRegions: [],
    bottomRegions: [],
    allRegions: [],
    topHotPassRegions: [],
    bottomHotPassRegions: [],
    totalTrips: 0,
    totalPassthroughs: 0,
    totalHotPasses: 0,
    totalQuotes: 0,
    overallTpRate: 0,
    overallHotPassRate: 0,
    overallPqRate: 0,
  };

  if (trips.length === 0) {
    return emptyResult;
  }

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe);

  // Find relevant columns in trips data
  const regionCol = findColumn(trips[0], ['destination', 'region', 'country', 'original interest']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);
  if (!regionCol) {
    return emptyResult;
  }

  // Find region columns in hot pass data
  const hotPassRegionCol = hotPassData.length > 0
    ? findColumn(hotPassData[0], ['destination', 'region', 'country', 'original interest'])
    : null;
  const hotPassDateCol = hotPassData.length > 0
    ? findColumn(hotPassData[0], ['passthrough to sales date', 'passthrough date', 'created date'])
    : null;

  // Find region column in passthroughs report for accurate PT counting (matches KPI pipeline)
  const ptRegionCol = passthroughsData.length > 0
    ? findColumn(passthroughsData[0], ['destination', 'region', 'country', 'original interest'])
    : null;
  const ptDateCol = passthroughsData.length > 0
    ? findColumn(passthroughsData[0], ['passthrough to sales date', 'passthrough date', 'created date', 'date'])
    : null;

  // Find region column in quotes data for P>Q calculation
  const quotesRegionCol = quotesData.length > 0
    ? findColumn(quotesData[0], ['destination', 'region', 'country', 'original interest'])
    : null;
  const quotesDateCol = quotesData.length > 0
    ? findColumn(quotesData[0], ['quote first sent', 'first sent date', 'created date', 'date'])
    : null;

  // Group by region - include hot passes and quotes
  const regionStats: Record<string, { trips: number; passthroughs: number; hotPasses: number; quotes: number }> = {};

  // Excluded regions (case-insensitive matching)
  const excludedRegions = ['caribbean'];
  const isExcluded = (region: string) =>
    excludedRegions.some(excluded => region.toLowerCase().includes(excluded));

  // Process trips data — count trips per destination
  for (const row of trips) {
    const region = (row[regionCol] || '').trim();
    if (!region || region.length < 2) continue;
    if (isExcluded(region)) continue;

    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

    if (!regionStats[region]) {
      regionStats[region] = { trips: 0, passthroughs: 0, hotPasses: 0, quotes: 0 };
    }

    regionStats[region].trips++;

    // Fallback: count passthroughs from trips report if no separate PT report
    if (!ptRegionCol) {
      const hasPassthrough = passthroughDateCol && (row[passthroughDateCol] || '').trim().length > 0;
      if (hasPassthrough) {
        regionStats[region].passthroughs++;
      }
    }
  }

  // Count passthroughs from the separate passthroughs report (matches KPI pipeline)
  if (ptRegionCol) {
    for (const row of passthroughsData) {
      const region = (row[ptRegionCol] || '').trim();
      if (!region || region.length < 2) continue;
      if (isExcluded(region)) continue;

      const rowDate = ptDateCol ? row[ptDateCol] : '';
      if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

      if (!regionStats[region]) {
        regionStats[region] = { trips: 0, passthroughs: 0, hotPasses: 0, quotes: 0 };
      }
      regionStats[region].passthroughs++;
    }
  }

  // Process hot pass data
  if (hotPassRegionCol) {
    for (const row of hotPassData) {
      const region = (row[hotPassRegionCol] || '').trim();
      if (!region || region.length < 2) continue;
      if (isExcluded(region)) continue;

      const rowDate = hotPassDateCol ? row[hotPassDateCol] : '';
      if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

      // Only count if we have trips data for this region
      if (regionStats[region]) {
        regionStats[region].hotPasses++;
      }
    }
  }

  // Process quotes data to count quotes by destination for P>Q calculation
  if (quotesRegionCol) {
    for (const row of quotesData) {
      const region = (row[quotesRegionCol] || '').trim();
      if (!region || region.length < 2) continue;
      if (isExcluded(region)) continue;

      const rowDate = quotesDateCol ? row[quotesDateCol] : '';
      if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

      // Only count if we have trips/passthrough data for this region
      if (regionStats[region]) {
        regionStats[region].quotes++;
      }
    }
  }

  // Convert to array and calculate rates
  const allRegions: RegionalPerformance[] = Object.entries(regionStats)
    .filter(([, stats]) => stats.trips >= 3) // Minimum threshold for meaningful rate
    .map(([region, stats]) => ({
      region,
      trips: stats.trips,
      passthroughs: stats.passthroughs,
      tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
      hotPasses: stats.hotPasses,
      hotPassRate: stats.passthroughs > 0 ? (stats.hotPasses / stats.passthroughs) * 100 : 0,
      quotes: stats.quotes,
      pqRate: stats.passthroughs > 0 ? (stats.quotes / stats.passthroughs) * 100 : 0,
    }));

  // Compute overall totals directly from raw CSVs (matching KPI Summary pipeline exactly).
  // This bypasses destination-grouping, exclusions, and guards so totals match the Summary tab.
  // Helper: find an agent-like column in a CSV row for metadata filtering
  const findAgentCol = (row: CSVRow): string | null => {
    const keys = Object.keys(row);
    const agentNames = ['_agent', 'gtt owner', 'last gtt action by', 'owner name', 'agent', 'name'];
    for (const name of agentNames) {
      const match = keys.find(k => k.toLowerCase().includes(name));
      if (match) return match;
    }
    return null;
  };

  // Inline metadata detection (avoids cross-module import that can cause bundling issues)
  const METADATA_RX = [
    /^as of \d{4}/i, /^channel:/i, /^date field:/i, /^filtered by$/i,
    /^field \//i, /^show:/i, /^total$/i, /^grand total/i, /^subtotal/i,
    /^gtt owner/i, /^last gtt action by/i, /^new value /i,
    /^passthrough date vs/i, /^passthrough to sales date /i, /^trip channel /i,
    /equals /i, /^you've reached/i, /generated by .* sorted by/i, / ↑$/, / ↓$/,
    /\bcount\b/i, /\bunique\b/i, /\bsum\b/i, /\baverage\b/i, /\brecord/i,
    /\bformula/i, /\breport\b/i, /^group /i, /^powered by/i, /^confidential/i,
    /^copyright/i, /^\d+\s*row/i, /^page \d/i, /^-+$/, /^=+$/, /^\d+$/,
    /\bsorted\b/i, /\bfiltered\b/i, /\bgrouped\b/i, /\bgenerated\b/i,
  ];
  const isMetaValue = (v: string): boolean => {
    if (!v) return true;
    const t = v.trim();
    if (t.length === 0 || t.length > 60) return true;
    if (/[=<>{}|\\[\]#@:;()\/]/.test(t)) return true;
    const lc = (t.match(/[a-zA-Z]/g) || []).length;
    if (lc < 2) return true;
    if (METADATA_RX.some(p => p.test(t))) return true;
    if (t.split(/\s+/).length > 5) return true;
    const tc = t.replace(/\s/g, '').length;
    if (tc > 0 && lc / tc < 0.7) return true;
    return false;
  };
  const isMetaRow = (row: CSVRow, agentCol: string | null): boolean => {
    if (agentCol) return isMetaValue((row[agentCol] || '').trim());
    return Object.values(row).some(v => {
      const s = (v || '').trim().toLowerCase();
      return s === 'grand total' || s === 'total' || s.startsWith('subtotal');
    });
  };

  const tripsAgentCol = findAgentCol(trips[0]);
  let totalTrips = 0;
  for (const row of trips) {
    if (row['_groupHeader']) continue;
    if (isMetaRow(row, tripsAgentCol)) continue;
    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;
    totalTrips++;
  }

  let totalPassthroughs = 0;
  if (passthroughsData.length > 0) {
    const ptAgentCol = findAgentCol(passthroughsData[0]);
    // Count from the separate passthroughs report (same source as KPI)
    for (const row of passthroughsData) {
      if (row['_groupHeader']) continue;
      if (isMetaRow(row, ptAgentCol)) continue;
      const rowDate = ptDateCol ? row[ptDateCol] : '';
      if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;
      totalPassthroughs++;
    }
  } else {
    // Fallback: derive from trips report passthrough date column
    for (const row of trips) {
      if (row['_groupHeader']) continue;
      if (isMetaRow(row, tripsAgentCol)) continue;
      const rowDate = dateCol ? row[dateCol] : '';
      if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;
      const hasPassthrough = passthroughDateCol && (row[passthroughDateCol] || '').trim().length > 0;
      if (hasPassthrough) totalPassthroughs++;
    }
  }

  let totalHotPasses = 0;
  if (hotPassData.length > 0) {
    const hpAgentCol = findAgentCol(hotPassData[0]);
    for (const row of hotPassData) {
      if (row['_groupHeader']) continue;
      if (isMetaRow(row, hpAgentCol)) continue;
      const rowDate = hotPassDateCol ? row[hotPassDateCol] : '';
      if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;
      totalHotPasses++;
    }
  }

  let totalQuotes = 0;
  if (quotesData.length > 0) {
    const qAgentCol = findAgentCol(quotesData[0]);
    for (const row of quotesData) {
      if (row['_groupHeader']) continue;
      if (isMetaRow(row, qAgentCol)) continue;
      const rowDate = quotesDateCol ? row[quotesDateCol] : '';
      if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;
      totalQuotes++;
    }
  }
  const overallTpRate = totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0;
  const overallHotPassRate = totalPassthroughs > 0 ? (totalHotPasses / totalPassthroughs) * 100 : 0;
  const overallPqRate = totalPassthroughs > 0 ? (totalQuotes / totalPassthroughs) * 100 : 0;

  // Sort all regions by T>P rate for general display
  const sortedByRate = [...allRegions].sort((a, b) => b.tpRate - a.tpRate);

  // Top performing T>P: Weight by volume
  const topPerforming = [...allRegions]
    .filter(r => r.tpRate >= overallTpRate)
    .sort((a, b) => {
      const scoreA = a.tpRate * Math.log10(a.trips + 1);
      const scoreB = b.tpRate * Math.log10(b.trips + 1);
      return scoreB - scoreA;
    })
    .slice(0, 5);

  // Needs improvement T>P: Weight by potential impact
  const needsImprovement = [...allRegions]
    .filter(r => r.tpRate < overallTpRate)
    .map(r => ({
      ...r,
      potentialGain: ((overallTpRate / 100) * r.trips) - r.passthroughs,
      impactScore: r.trips * Math.abs(overallTpRate - r.tpRate),
    }))
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5);

  // Top hot pass regions (only include regions with enough passthroughs)
  const topHotPassRegions = [...allRegions]
    .filter(r => r.passthroughs >= 3 && r.hotPassRate >= overallHotPassRate)
    .sort((a, b) => {
      const scoreA = a.hotPassRate * Math.log10(a.passthroughs + 1);
      const scoreB = b.hotPassRate * Math.log10(b.passthroughs + 1);
      return scoreB - scoreA;
    })
    .slice(0, 5);

  // Bottom hot pass regions (needs improvement)
  const bottomHotPassRegions = [...allRegions]
    .filter(r => r.passthroughs >= 3 && r.hotPassRate < overallHotPassRate)
    .sort((a, b) => {
      // Sort by impact: more passthroughs + lower rate = bigger opportunity
      const impactA = a.passthroughs * Math.abs(overallHotPassRate - a.hotPassRate);
      const impactB = b.passthroughs * Math.abs(overallHotPassRate - b.hotPassRate);
      return impactB - impactA;
    })
    .slice(0, 5);

  return {
    topRegions: topPerforming,
    bottomRegions: needsImprovement,
    allRegions: sortedByRate,
    topHotPassRegions,
    bottomHotPassRegions,
    totalTrips,
    totalPassthroughs,
    totalHotPasses,
    totalQuotes,
    overallTpRate,
    overallHotPassRate,
    overallPqRate,
  };
};

export const generateDepartmentRecommendations = (
  performance: DepartmentRegionalPerformance,
  prevQuarterPerformance?: DepartmentRegionalPerformance
): DepartmentImprovementRecommendation[] => {
  if (performance.allRegions.length === 0) return [];

  // Build prev quarter lookup for QTD vs prev quarter comparison
  const prevLookup = new Map<string, number>();
  if (prevQuarterPerformance) {
    for (const r of prevQuarterPerformance.allRegions) {
      prevLookup.set(r.region, r.tpRate);
    }
  }
  const deptAvgRate = performance.overallTpRate;

  // Compare each destination's QTD rate vs its previous quarter rate (or dept avg as fallback)
  const belowPrev = performance.allRegions
    .filter(r => r.trips >= 3)
    .map(r => {
      const baselineRate = prevLookup.get(r.region) ?? deptAvgRate;
      const deviation = r.tpRate - baselineRate;
      // potentialGain: extra passthroughs if matched previous quarter rate
      const expectedPassthroughs = (baselineRate / 100) * r.trips;
      const potentialGain = Math.max(0, expectedPassthroughs - r.passthroughs);

      return {
        region: r.region,
        tpRate: r.tpRate,
        departmentAvgRate: baselineRate, // prev quarter rate (or dept avg fallback)
        deviation,
        trips: r.trips,
        passthroughs: r.passthroughs,
        potentialGain,
        impactScore: potentialGain, // Rank directly by quantitative gain
      };
    })
    .filter(r => r.deviation < -1 && prevLookup.has(r.region)) // only destinations that declined vs prev qtr
    .sort((a, b) => b.potentialGain - a.potentialGain);

  return belowPrev.slice(0, 5).map((r) => {
    let priority: 'high' | 'medium' | 'low';
    if (r.potentialGain >= 10 || (r.trips >= 100 && r.potentialGain >= 5)) {
      priority = 'high';
    } else if (r.potentialGain >= 5 || r.trips >= 50) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    const deviationAbs = Math.abs(r.deviation).toFixed(1);
    const potentialGainRounded = Math.round(r.potentialGain);
    let reason: string;

    if (r.trips >= 100 && potentialGainRounded >= 10) {
      reason = `High-impact: ${r.trips} trips, down ${deviationAbs}pp vs prev quarter. Could recover ~${potentialGainRounded} passthroughs.`;
    } else if (r.trips >= 100) {
      reason = `High-volume (${r.trips} trips), down ${deviationAbs}pp. Recovery potential: ~${potentialGainRounded} PTs.`;
    } else if (potentialGainRounded >= 5) {
      reason = `Down ${deviationAbs}pp vs prev quarter. ~${potentialGainRounded} potential passthroughs to recover.`;
    } else {
      reason = `${r.trips} trips, down ${deviationAbs}pp vs prev quarter. ~${potentialGainRounded} PTs recoverable.`;
    }

    return { ...r, priority, reason };
  });
};

// Generate P>Q improvement recommendations (QTD vs previous quarter, ranked by potentialGain)
export const generatePqDepartmentRecommendations = (
  performance: DepartmentRegionalPerformance,
  prevQuarterPerformance?: DepartmentRegionalPerformance
): DepartmentImprovementRecommendation[] => {
  if (performance.allRegions.length === 0 || performance.totalPassthroughs === 0) return [];

  // Build prev quarter lookup for P>Q
  const prevLookup = new Map<string, number>();
  if (prevQuarterPerformance) {
    for (const r of prevQuarterPerformance.allRegions) {
      prevLookup.set(r.region, r.pqRate);
    }
  }
  const deptAvgRate = performance.overallPqRate;

  const belowPrev = performance.allRegions
    .filter(r => r.passthroughs >= 3)
    .map(r => {
      const baselineRate = prevLookup.get(r.region) ?? deptAvgRate;
      const deviation = r.pqRate - baselineRate;
      const expectedQuotes = (baselineRate / 100) * r.passthroughs;
      const potentialGain = Math.max(0, expectedQuotes - r.quotes);

      return {
        region: r.region,
        tpRate: r.pqRate,
        departmentAvgRate: baselineRate,
        deviation,
        trips: r.passthroughs,
        passthroughs: r.quotes,
        potentialGain,
        impactScore: potentialGain,
      };
    })
    .filter(r => r.deviation < -1 && prevLookup.has(r.region))
    .sort((a, b) => b.potentialGain - a.potentialGain);

  return belowPrev.slice(0, 5).map((r) => {
    let priority: 'high' | 'medium' | 'low';
    if (r.potentialGain >= 8 || (r.trips >= 50 && r.potentialGain >= 4)) {
      priority = 'high';
    } else if (r.potentialGain >= 4 || r.trips >= 25) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    const deviationAbs = Math.abs(r.deviation).toFixed(1);
    const potentialGainRounded = Math.round(r.potentialGain);
    let reason: string;

    if (r.trips >= 50 && potentialGainRounded >= 8) {
      reason = `High-impact: ${r.trips} PTs, P>Q down ${deviationAbs}pp vs prev quarter. Could recover ~${potentialGainRounded} quotes.`;
    } else if (r.trips >= 50) {
      reason = `High-volume (${r.trips} PTs), P>Q down ${deviationAbs}pp. Recovery potential: ~${potentialGainRounded} quotes.`;
    } else if (potentialGainRounded >= 4) {
      reason = `P>Q down ${deviationAbs}pp vs prev quarter. ~${potentialGainRounded} potential quotes to recover.`;
    } else {
      reason = `${r.trips} PTs, P>Q down ${deviationAbs}pp vs prev quarter. ~${potentialGainRounded} quotes recoverable.`;
    }

    return { ...r, priority, reason };
  });
};

export const analyzeRegionalPerformanceByAgent = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all'
): AgentRegionalPerformance[] => {
  if (trips.length === 0) return [];

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe);

  // Find relevant columns
  const regionCol = findColumn(trips[0], ['destination', 'region', 'country', 'original interest']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);
  const keys = Object.keys(trips[0]);
  const agentCol = keys.find(k =>
    k.toLowerCase().includes('gtt owner') ||
    k.toLowerCase().includes('owner name') ||
    k.toLowerCase().includes('agent') ||
    k.includes('_agent')
  );

  if (!regionCol || !agentCol) return [];

  // Excluded regions (case-insensitive matching)
  const excludedRegions = ['caribbean'];
  const isExcluded = (region: string) =>
    excludedRegions.some(excluded => region.toLowerCase().includes(excluded));

  // Group by agent then region
  const agentStats: Record<string, Record<string, { trips: number; passthroughs: number }>> = {};
  let currentAgent = '';

  for (const row of trips) {
    const agent = (row[agentCol] || '').trim();
    if (agent && !/^\d+$/.test(agent)) currentAgent = agent;
    if (!currentAgent) continue;

    const region = (row[regionCol] || '').trim();
    if (!region || region.length < 2) continue;

    // Skip excluded regions
    if (isExcluded(region)) continue;

    // Check timeframe filter
    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

    if (!agentStats[currentAgent]) {
      agentStats[currentAgent] = {};
    }
    if (!agentStats[currentAgent][region]) {
      agentStats[currentAgent][region] = { trips: 0, passthroughs: 0 };
    }

    agentStats[currentAgent][region].trips++;

    if (passthroughDateCol) {
      const passthroughDate = (row[passthroughDateCol] || '').trim();
      if (passthroughDate && passthroughDate.length > 0) {
        agentStats[currentAgent][region].passthroughs++;
      }
    }
  }

  // Convert to array
  return Object.entries(agentStats)
    .map(([agentName, regions]) => {
      const regionPerf: RegionalPerformance[] = Object.entries(regions)
        .filter(([, stats]) => stats.trips >= 2) // Lower threshold per agent
        .map(([region, stats]) => ({
          region,
          trips: stats.trips,
          passthroughs: stats.passthroughs,
          tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
          hotPasses: 0, // Not tracked at agent level
          hotPassRate: 0,
          quotes: 0,
          pqRate: 0,
        }));

      const totalTrips = regionPerf.reduce((sum, r) => sum + r.trips, 0);
      const totalPassthroughs = regionPerf.reduce((sum, r) => sum + r.passthroughs, 0);
      const overallTpRate = totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0;

      // Top regions: Weight by volume × rate for high-impact strengths
      const topRegions = [...regionPerf]
        .filter(r => r.tpRate >= overallTpRate)
        .sort((a, b) => {
          const scoreA = a.tpRate * Math.log10(a.trips + 1);
          const scoreB = b.tpRate * Math.log10(b.trips + 1);
          return scoreB - scoreA;
        })
        .slice(0, 3);

      // Bottom regions: Weight by potential improvement impact
      const bottomRegions = [...regionPerf]
        .filter(r => r.tpRate < overallTpRate && r.trips >= 2)
        .map(r => ({
          ...r,
          impactScore: r.trips * Math.abs(overallTpRate - r.tpRate),
        }))
        .sort((a, b) => b.impactScore - a.impactScore)
        .slice(0, 3);

      return {
        agentName,
        topRegions,
        bottomRegions,
        totalTrips,
        totalPassthroughs,
        overallTpRate,
      };
    })
    .filter(a => a.totalTrips >= 5) // Only agents with meaningful data
    .sort((a, b) => b.totalTrips - a.totalTrips);
};

export const analyzeAgentRegionalDeviations = (
  trips: CSVRow[],
  departmentPerformance: DepartmentRegionalPerformance,
  timeframe: RegionalTimeframe = 'all'
): AgentRegionalAnalysis[] => {
  if (trips.length === 0 || departmentPerformance.allRegions.length === 0) return [];

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe);

  // Create a map of department T>P rates by region
  const deptRateByRegion = new Map<string, { tpRate: number; trips: number }>();
  for (const region of departmentPerformance.allRegions) {
    deptRateByRegion.set(region.region, { tpRate: region.tpRate, trips: region.trips });
  }

  // Find relevant columns
  const regionCol = findColumn(trips[0], ['destination', 'region', 'country', 'original interest']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);
  const keys = Object.keys(trips[0]);
  const agentCol = keys.find(k =>
    k.toLowerCase().includes('gtt owner') ||
    k.toLowerCase().includes('owner name') ||
    k.toLowerCase().includes('agent') ||
    k.includes('_agent')
  );

  if (!regionCol || !agentCol) return [];

  // Excluded regions
  const excludedRegions = ['caribbean'];
  const isExcluded = (region: string) =>
    excludedRegions.some(excluded => region.toLowerCase().includes(excluded));

  // Group by agent then region
  const agentStats: Record<string, Record<string, { trips: number; passthroughs: number }>> = {};
  let currentAgent = '';

  for (const row of trips) {
    const agent = (row[agentCol] || '').trim();
    if (agent && !/^\d+$/.test(agent)) currentAgent = agent;
    if (!currentAgent) continue;

    const region = (row[regionCol] || '').trim();
    if (!region || region.length < 2) continue;
    if (isExcluded(region)) continue;

    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

    if (!agentStats[currentAgent]) {
      agentStats[currentAgent] = {};
    }
    if (!agentStats[currentAgent][region]) {
      agentStats[currentAgent][region] = { trips: 0, passthroughs: 0 };
    }

    agentStats[currentAgent][region].trips++;

    if (passthroughDateCol) {
      const passthroughDate = (row[passthroughDateCol] || '').trim();
      if (passthroughDate && passthroughDate.length > 0) {
        agentStats[currentAgent][region].passthroughs++;
      }
    }
  }

  // Calculate total department trips for weighting
  const totalDeptTrips = departmentPerformance.totalTrips;

  // Convert to array with deviation analysis
  return Object.entries(agentStats)
    .map(([agentName, regions]) => {
      const allDeviations: RegionalDeviation[] = [];

      for (const [region, stats] of Object.entries(regions)) {
        if (stats.trips < 2) continue; // Need minimum data

        const deptData = deptRateByRegion.get(region);
        if (!deptData) continue; // Region not in department data

        const agentTpRate = stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0;
        const deviation = agentTpRate - deptData.tpRate;

        // Impact score: combines magnitude of underperformance with volume
        // For underperformers: higher negative deviation + higher volume = higher impact
        // We use department trips as the volume indicator (opportunity size)
        // Score = |deviation| * sqrt(deptTrips / totalDeptTrips) * 100
        // sqrt dampens the volume effect so one huge region doesn't dominate
        const volumeWeight = Math.sqrt(deptData.trips / Math.max(totalDeptTrips, 1));
        const impactScore = Math.abs(deviation) * volumeWeight * 100;

        allDeviations.push({
          region,
          agentTpRate,
          departmentTpRate: deptData.tpRate,
          deviation,
          agentTrips: stats.trips,
          agentPassthroughs: stats.passthroughs,
          departmentTrips: deptData.trips,
          impactScore,
        });
      }

      // Sort by deviation for above/below average
      const aboveAverage = allDeviations
        .filter(d => d.deviation > 0)
        .sort((a, b) => b.deviation - a.deviation);

      const belowAverage = allDeviations
        .filter(d => d.deviation < 0)
        .sort((a, b) => a.deviation - b.deviation); // Most negative first

      // Generate recommendations: underperforming regions sorted by impact
      const recommendations: AgentImprovementRecommendation[] = belowAverage
        .sort((a, b) => b.impactScore - a.impactScore)
        .slice(0, 5)
        .map((d, index) => {
          // Determine priority based on impact score ranking
          let priority: 'high' | 'medium' | 'low';
          if (index === 0 && d.impactScore > 5) {
            priority = 'high';
          } else if (index < 2 && d.impactScore > 2) {
            priority = 'medium';
          } else {
            priority = 'low';
          }

          // Generate reason
          let reason: string;
          const deviationAbs = Math.abs(d.deviation).toFixed(1);
          if (d.departmentTrips > 50 && Math.abs(d.deviation) > 10) {
            reason = `High-volume region (${d.departmentTrips} dept trips) with significant gap of -${deviationAbs}pp`;
          } else if (d.departmentTrips > 50) {
            reason = `High-volume region (${d.departmentTrips} dept trips) - small improvements have big impact`;
          } else if (Math.abs(d.deviation) > 15) {
            reason = `Large performance gap of -${deviationAbs}pp vs department average`;
          } else {
            reason = `${deviationAbs}pp below department average with ${d.departmentTrips} dept trips`;
          }

          return {
            region: d.region,
            priority,
            deviation: d.deviation,
            agentTrips: d.agentTrips,
            departmentTrips: d.departmentTrips,
            agentTpRate: d.agentTpRate,
            departmentTpRate: d.departmentTpRate,
            impactScore: d.impactScore,
            reason,
          };
        });

      const totalTrips = Object.values(regions).reduce((sum, r) => sum + r.trips, 0);
      const totalPassthroughs = Object.values(regions).reduce((sum, r) => sum + r.passthroughs, 0);

      return {
        agentName,
        totalTrips,
        totalPassthroughs,
        overallTpRate: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
        aboveAverage,
        belowAverage,
        allDeviations: allDeviations.sort((a, b) => b.deviation - a.deviation),
        recommendations,
      };
    })
    .filter(a => a.totalTrips >= 5)
    .sort((a, b) => b.totalTrips - a.totalTrips);
};

export const analyzeRegionalTrends = (
  trips: CSVRow[],
  periodCount: number = 6
): RegionalTrendData => {
  if (trips.length === 0) {
    return { periods: [], topRegionsByPeriod: new Map(), allTrends: [] };
  }

  // Find relevant columns
  const regionCol = findColumn(trips[0], ['destination', 'region', 'country', 'original interest']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);

  if (!regionCol || !dateCol) {
    return { periods: [], topRegionsByPeriod: new Map(), allTrends: [] };
  }

  // Find date range
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const row of trips) {
    const date = parseDate(row[dateCol]);
    if (date) {
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
  }

  if (!minDate || !maxDate) {
    return { periods: [], topRegionsByPeriod: new Map(), allTrends: [] };
  }

  // Create monthly periods going back from now
  const periods: { name: string; start: Date; end: Date }[] = [];
  const now = new Date();

  for (let i = periodCount - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const name = start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    periods.push({ name, start, end });
  }

  // Aggregate data by period and region
  const periodRegionStats: Record<string, Record<string, { trips: number; passthroughs: number }>> = {};

  for (const period of periods) {
    periodRegionStats[period.name] = {};
  }

  for (const row of trips) {
    const date = parseDate(row[dateCol]);
    if (!date) continue;

    const region = (row[regionCol] || '').trim();
    if (!region || region.length < 2) continue;

    // Find which period this belongs to
    const period = periods.find(p => date >= p.start && date <= p.end);
    if (!period) continue;

    if (!periodRegionStats[period.name][region]) {
      periodRegionStats[period.name][region] = { trips: 0, passthroughs: 0 };
    }

    periodRegionStats[period.name][region].trips++;

    if (passthroughDateCol) {
      const passthroughDate = (row[passthroughDateCol] || '').trim();
      if (passthroughDate && passthroughDate.length > 0) {
        periodRegionStats[period.name][region].passthroughs++;
      }
    }
  }

  // Build trend data
  const topRegionsByPeriod = new Map<string, RegionalPerformance[]>();
  const allTrends: RegionalTrendPoint[] = [];

  for (const period of periods) {
    const regionData = periodRegionStats[period.name];
    const regionPerf: RegionalPerformance[] = Object.entries(regionData)
      .filter(([, stats]) => stats.trips >= 3)
      .map(([region, stats]) => ({
        region,
        trips: stats.trips,
        passthroughs: stats.passthroughs,
        tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
        hotPasses: 0, // Not tracked in trends
        hotPassRate: 0,
        quotes: 0,
        pqRate: 0,
      }))
      .sort((a, b) => b.tpRate - a.tpRate);

    topRegionsByPeriod.set(period.name, regionPerf.slice(0, 5));

    for (const perf of regionPerf) {
      allTrends.push({
        period: period.name,
        periodStart: period.start,
        region: perf.region,
        tpRate: perf.tpRate,
        trips: perf.trips,
        passthroughs: perf.passthroughs,
      });
    }
  }

  return {
    periods: periods.map(p => p.name),
    topRegionsByPeriod,
    allTrends,
  };
};

// ============ Repeat Client Performance Analysis ============

export const analyzeRepeatClientPerformance = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all'
): DepartmentClientSegmentPerformance => {
  if (trips.length === 0) {
    return {
      segments: [],
      totalTrips: 0,
      totalPassthroughs: 0,
      overallTpRate: 0,
    };
  }

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe);

  // Find relevant columns
  const repeatCol = findColumn(trips[0], ['repeat/new', 'repeat', 'client type', 'customer type']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);

  if (!repeatCol) {
    return {
      segments: [],
      totalTrips: 0,
      totalPassthroughs: 0,
      overallTpRate: 0,
    };
  }

  // Track stats by segment
  const segmentStats: Record<string, { trips: number; passthroughs: number }> = {
    repeat: { trips: 0, passthroughs: 0 },
    new: { trips: 0, passthroughs: 0 },
  };

  for (const row of trips) {
    // Check timeframe filter
    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

    const repeatValue = (row[repeatCol] || '').trim().toLowerCase();
    const isRepeat = repeatValue === 'repeat';
    const segment = isRepeat ? 'repeat' : 'new';

    segmentStats[segment].trips++;

    // Check if there's a passthrough date
    if (passthroughDateCol) {
      const passthroughDate = (row[passthroughDateCol] || '').trim();
      if (passthroughDate && passthroughDate.length > 0) {
        segmentStats[segment].passthroughs++;
      }
    }
  }

  // Convert to array and calculate rates
  const segments: ClientSegmentPerformance[] = Object.entries(segmentStats)
    .filter(([, stats]) => stats.trips > 0)
    .map(([segment, stats]) => ({
      segment: segment.charAt(0).toUpperCase() + segment.slice(1), // Capitalize
      trips: stats.trips,
      passthroughs: stats.passthroughs,
      tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
    }))
    .sort((a, b) => b.tpRate - a.tpRate);

  const totalTrips = segments.reduce((sum, s) => sum + s.trips, 0);
  const totalPassthroughs = segments.reduce((sum, s) => sum + s.passthroughs, 0);

  return {
    segments,
    totalTrips,
    totalPassthroughs,
    overallTpRate: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
  };
};

export const analyzeRepeatClientPerformanceByAgent = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all'
): AgentClientSegmentPerformance[] => {
  if (trips.length === 0) return [];

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe);

  // Find relevant columns
  const repeatCol = findColumn(trips[0], ['repeat/new', 'repeat', 'client type', 'customer type']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);
  const keys = Object.keys(trips[0]);
  const agentCol = keys.find(k =>
    k.toLowerCase().includes('gtt owner') ||
    k.toLowerCase().includes('owner name') ||
    k.toLowerCase().includes('agent') ||
    k.includes('_agent')
  );

  if (!repeatCol || !agentCol) return [];

  // Group by agent then segment
  const agentStats: Record<string, Record<string, { trips: number; passthroughs: number }>> = {};
  let currentAgent = '';

  for (const row of trips) {
    const agent = (row[agentCol] || '').trim();
    if (agent && !/^\d+$/.test(agent)) currentAgent = agent;
    if (!currentAgent) continue;

    // Check timeframe filter
    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

    const repeatValue = (row[repeatCol] || '').trim().toLowerCase();
    const isRepeat = repeatValue === 'repeat';
    const segment = isRepeat ? 'repeat' : 'new';

    if (!agentStats[currentAgent]) {
      agentStats[currentAgent] = {
        repeat: { trips: 0, passthroughs: 0 },
        new: { trips: 0, passthroughs: 0 },
      };
    }

    agentStats[currentAgent][segment].trips++;

    if (passthroughDateCol) {
      const passthroughDate = (row[passthroughDateCol] || '').trim();
      if (passthroughDate && passthroughDate.length > 0) {
        agentStats[currentAgent][segment].passthroughs++;
      }
    }
  }

  // Convert to array
  return Object.entries(agentStats)
    .map(([agentName, segments]) => {
      const segmentPerf: ClientSegmentPerformance[] = Object.entries(segments)
        .filter(([, stats]) => stats.trips > 0)
        .map(([segment, stats]) => ({
          segment: segment.charAt(0).toUpperCase() + segment.slice(1),
          trips: stats.trips,
          passthroughs: stats.passthroughs,
          tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
        }))
        .sort((a, b) => b.tpRate - a.tpRate);

      const totalTrips = segmentPerf.reduce((sum, s) => sum + s.trips, 0);
      const totalPassthroughs = segmentPerf.reduce((sum, s) => sum + s.passthroughs, 0);

      return {
        agentName,
        segments: segmentPerf,
        totalTrips,
        totalPassthroughs,
        overallTpRate: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
      };
    })
    .filter(a => a.totalTrips >= 5)
    .sort((a, b) => b.totalTrips - a.totalTrips);
};

// ============ B2B/B2C Performance Analysis ============

export const analyzeB2BPerformance = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all'
): DepartmentClientSegmentPerformance => {
  if (trips.length === 0) {
    return {
      segments: [],
      totalTrips: 0,
      totalPassthroughs: 0,
      overallTpRate: 0,
    };
  }

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe);

  // Find relevant columns
  const b2bCol = findColumn(trips[0], ['b2b/b2c', 'b2b', 'business type', 'client category']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);

  if (!b2bCol) {
    return {
      segments: [],
      totalTrips: 0,
      totalPassthroughs: 0,
      overallTpRate: 0,
    };
  }

  // Track stats by segment
  const segmentStats: Record<string, { trips: number; passthroughs: number }> = {
    b2b: { trips: 0, passthroughs: 0 },
    b2c: { trips: 0, passthroughs: 0 },
  };

  for (const row of trips) {
    // Check timeframe filter
    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

    const b2bValue = (row[b2bCol] || '').trim().toLowerCase();
    // Default to B2C if value isn't clearly B2B
    const isB2B = b2bValue === 'b2b';
    const segment = isB2B ? 'b2b' : 'b2c';

    segmentStats[segment].trips++;

    // Check if there's a passthrough date
    if (passthroughDateCol) {
      const passthroughDate = (row[passthroughDateCol] || '').trim();
      if (passthroughDate && passthroughDate.length > 0) {
        segmentStats[segment].passthroughs++;
      }
    }
  }

  // Convert to array and calculate rates
  const segments: ClientSegmentPerformance[] = Object.entries(segmentStats)
    .filter(([, stats]) => stats.trips > 0)
    .map(([segment, stats]) => ({
      segment: segment.toUpperCase(), // B2B, B2C
      trips: stats.trips,
      passthroughs: stats.passthroughs,
      tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
    }))
    .sort((a, b) => b.tpRate - a.tpRate);

  const totalTrips = segments.reduce((sum, s) => sum + s.trips, 0);
  const totalPassthroughs = segments.reduce((sum, s) => sum + s.passthroughs, 0);

  return {
    segments,
    totalTrips,
    totalPassthroughs,
    overallTpRate: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
  };
};

export const analyzeB2BPerformanceByAgent = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all'
): AgentClientSegmentPerformance[] => {
  if (trips.length === 0) return [];

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe);

  // Find relevant columns
  const b2bCol = findColumn(trips[0], ['b2b/b2c', 'b2b', 'business type', 'client category']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);
  const keys = Object.keys(trips[0]);
  const agentCol = keys.find(k =>
    k.toLowerCase().includes('gtt owner') ||
    k.toLowerCase().includes('owner name') ||
    k.toLowerCase().includes('agent') ||
    k.includes('_agent')
  );

  if (!b2bCol || !agentCol) return [];

  // Group by agent then segment
  const agentStats: Record<string, Record<string, { trips: number; passthroughs: number }>> = {};
  let currentAgent = '';

  for (const row of trips) {
    const agent = (row[agentCol] || '').trim();
    if (agent && !/^\d+$/.test(agent)) currentAgent = agent;
    if (!currentAgent) continue;

    // Check timeframe filter
    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate, endDate)) continue;

    const b2bValue = (row[b2bCol] || '').trim().toLowerCase();
    const isB2B = b2bValue === 'b2b';
    const segment = isB2B ? 'b2b' : 'b2c';

    if (!agentStats[currentAgent]) {
      agentStats[currentAgent] = {
        b2b: { trips: 0, passthroughs: 0 },
        b2c: { trips: 0, passthroughs: 0 },
      };
    }

    agentStats[currentAgent][segment].trips++;

    if (passthroughDateCol) {
      const passthroughDate = (row[passthroughDateCol] || '').trim();
      if (passthroughDate && passthroughDate.length > 0) {
        agentStats[currentAgent][segment].passthroughs++;
      }
    }
  }

  // Convert to array
  return Object.entries(agentStats)
    .map(([agentName, segments]) => {
      const segmentPerf: ClientSegmentPerformance[] = Object.entries(segments)
        .filter(([, stats]) => stats.trips > 0)
        .map(([segment, stats]) => ({
          segment: segment.toUpperCase(),
          trips: stats.trips,
          passthroughs: stats.passthroughs,
          tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
        }))
        .sort((a, b) => b.tpRate - a.tpRate);

      const totalTrips = segmentPerf.reduce((sum, s) => sum + s.trips, 0);
      const totalPassthroughs = segmentPerf.reduce((sum, s) => sum + s.passthroughs, 0);

      return {
        agentName,
        segments: segmentPerf,
        totalTrips,
        totalPassthroughs,
        overallTpRate: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
      };
    })
    .filter(a => a.totalTrips >= 5)
    .sort((a, b) => b.totalTrips - a.totalTrips);
};

export const analyzeBookingCorrelations = (
  hotPass: CSVRow[],
  _bookings: CSVRow[],
  passthroughs: CSVRow[]
): BookingCorrelation[] => {
  const correlations: BookingCorrelation[] = [];

  if (hotPass.length === 0 || passthroughs.length === 0) return correlations;

  // Find relevant columns
  const hotPassDateCol = findColumn(hotPass[0], ['created date', 'enquiry date', 'trip created']);
  const passthroughDateCol = findColumn(passthroughs[0], ['passthrough to sales date', 'passthrough date']);

  if (!hotPassDateCol || !passthroughDateCol) return correlations;

  // Analyze day of week correlation
  const dayBookings: Record<string, { total: number; booked: number }> = {};

  for (const hp of hotPass) {
    const dt = parseDateTime(hp[hotPassDateCol]);
    if (dt) {
      if (!dayBookings[dt.dayName]) dayBookings[dt.dayName] = { total: 0, booked: 0 };
      dayBookings[dt.dayName].total++;
    }
  }

  // Note: This is a simplified correlation - in reality you'd need to match
  // individual records to determine if they resulted in bookings

  for (const [day, data] of Object.entries(dayBookings)) {
    if (data.total > 0) {
      // Estimate booking rate (this would need actual matching logic)
      correlations.push({
        factor: `Enquiries on ${day}`,
        bookedCount: Math.round(data.total * 0.15), // Placeholder
        notBookedCount: data.total - Math.round(data.total * 0.15),
        bookingRate: 15, // Placeholder
        description: `Hot passes created on ${day}`,
      });
    }
  }

  return correlations.sort((a, b) => b.bookingRate - a.bookingRate).slice(0, 5);
};

// ============ Main Analysis Function ============

export const generateInsightsData = (rawData: RawParsedData, timeframe: RegionalTimeframe = 'all'): InsightsData => {
  // Common date column patterns for different data types
  const passthroughDateCols = ['passthrough to sales date', 'passthrough date', 'created date', 'date'];
  const hotPassDateCols = ['hot pass date', 'created date', 'date'];
  const nonConvertedDateCols = ['created date', 'date', 'non-converted date'];
  const bookingDateCols = ['booking date', 'created date', 'date'];

  // Filter data by timeframe
  const filteredPassthroughs = filterRowsByTimeframe(rawData.passthroughs, timeframe, passthroughDateCols);
  const filteredHotPass = filterRowsByTimeframe(rawData.hotPass, timeframe, hotPassDateCols);
  const filteredNonConverted = filterRowsByTimeframe(rawData.nonConverted, timeframe, nonConvertedDateCols);
  const filteredBookings = filterRowsByTimeframe(rawData.bookings, timeframe, bookingDateCols);

  const passthroughsByDay = analyzePassthroughsByDay(filteredPassthroughs);
  const passthroughsByTime = analyzePassthroughsByTime(filteredPassthroughs);
  const hotPassByDay = analyzeHotPassByDay(filteredHotPass);
  const hotPassByTime = analyzeHotPassByTime(filteredHotPass);
  const topNonValidatedReasons = analyzeNonValidatedReasons(filteredNonConverted);
  const agentNonValidated = analyzeNonValidatedByAgent(filteredNonConverted);
  const bookingCorrelations = analyzeBookingCorrelations(
    filteredHotPass,
    filteredBookings,
    filteredPassthroughs
  );

  // Regional performance analysis (uses its own timeframe filtering)
  const departmentRegionalPerformance = analyzeRegionalPerformance(rawData.trips, timeframe, rawData.hotPass, rawData.quotes, rawData.passthroughs);
  const agentRegionalPerformance = analyzeRegionalPerformanceByAgent(rawData.trips, timeframe);
  const regionalTrends = analyzeRegionalTrends(rawData.trips, 6);
  const hasRegionalData = departmentRegionalPerformance.allRegions.length > 0;

  return {
    passthroughsByDay,
    passthroughsByTime,
    bestPassthroughDay: passthroughsByDay[0]?.day || null,
    bestPassthroughTime: passthroughsByTime[0]?.timeSlot || null,
    hotPassByDay,
    hotPassByTime,
    bestHotPassDay: hotPassByDay[0]?.day || null,
    bestHotPassTime: hotPassByTime[0]?.timeSlot || null,
    hasHotPassTimeData: hotPassByTime.length > 0,
    topNonValidatedReasons,
    agentNonValidated,
    bookingCorrelations,
    hasTimeData: passthroughsByTime.length > 0,
    hasNonValidatedReasons: topNonValidatedReasons.length > 0,
    hasBookingData: filteredBookings.length > 0,
    totalPassthroughs: filteredPassthroughs.length,
    totalNonValidated: filteredNonConverted.length,
    totalBookings: filteredBookings.length,
    totalHotPass: filteredHotPass.length,
    hasRegionalData,
    departmentRegionalPerformance,
    agentRegionalPerformance,
    regionalTrends,
  };
};

// ============ AI Analysis ============

export const buildInsightsPrompt = (insights: InsightsData): string => {
  const daySection = insights.passthroughsByDay.length > 0
    ? `PASSTHROUGH BY DAY OF WEEK:\n${insights.passthroughsByDay.map(d =>
        `- ${d.day}: ${d.count} (${d.percentage.toFixed(1)}%), avg ${d.avgPerDay.toFixed(1)}/day`
      ).join('\n')}`
    : 'No day-of-week data available';

  const timeSection = insights.hasTimeData
    ? `\nPASSTHROUGH BY TIME OF DAY:\n${insights.passthroughsByTime.map(t =>
        `- ${t.timeSlot}: ${t.count} (${t.percentage.toFixed(1)}%)`
      ).join('\n')}`
    : '\nNo time-of-day data available (timestamps may not include time)';

  const hotPassDaySection = insights.hotPassByDay.length > 0
    ? `\nHOT PASS BY DAY OF WEEK:\n${insights.hotPassByDay.map(d =>
        `- ${d.day}: ${d.count} (${d.percentage.toFixed(1)}%), avg ${d.avgPerDay.toFixed(1)}/day`
      ).join('\n')}`
    : '\nNo hot pass day-of-week data available';

  const hotPassTimeSection = insights.hasHotPassTimeData
    ? `\nHOT PASS BY TIME OF DAY:\n${insights.hotPassByTime.map(t =>
        `- ${t.timeSlot}: ${t.count} (${t.percentage.toFixed(1)}%)`
      ).join('\n')}`
    : '\nNo hot pass time-of-day data available';

  const reasonsSection = insights.hasNonValidatedReasons
    ? `\nTOP NON-VALIDATED REASONS (Department):\n${insights.topNonValidatedReasons.map(r =>
        `- "${r.reason}": ${r.count} (${r.percentage.toFixed(1)}%)`
      ).join('\n')}`
    : '\nNo non-validated reason data available';

  const agentSection = insights.agentNonValidated.length > 0
    ? `\nTOP AGENTS BY NON-VALIDATED COUNT:\n${insights.agentNonValidated.slice(0, 5).map(a =>
        `- ${a.agentName}: ${a.total} total, top reason: "${a.topReasons[0]?.reason || 'N/A'}"`
      ).join('\n')}`
    : '';

  return `You are a data analyst examining sales department performance data. Provide actionable insights based on the patterns below.

OVERVIEW:
- Total Passthroughs: ${insights.totalPassthroughs}
- Total Hot Passes: ${insights.totalHotPass}
- Total Bookings: ${insights.totalBookings}
- Total Non-Validated: ${insights.totalNonValidated}

${daySection}
${timeSection}
${hotPassDaySection}
${hotPassTimeSection}
${reasonsSection}
${agentSection}

Provide analysis in this format (be specific with numbers and percentages):

**Key Findings:**
- [3-4 bullet points with the most important patterns discovered]

**Optimal Timing Recommendations:**
- [2-3 bullet points on best days/times for passthroughs and hot passes based on the data]

**Non-Validated Lead Insights:**
- [2-3 bullet points analyzing the common reasons and suggesting improvements]

**Actionable Recommendations:**
- [3-4 specific, actionable recommendations for the department]`;
};

export const generateAIInsights = async (
  insights: InsightsData,
  apiKey: string
): Promise<string> => {
  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const prompt = buildInsightsPrompt(insights);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : '';
};

// ============ Column Discovery (for debugging) ============

export const discoverColumns = (rawData: RawParsedData): Record<string, string[]> => {
  return {
    trips: Object.keys(rawData.trips[0] || {}),
    quotes: Object.keys(rawData.quotes[0] || {}),
    passthroughs: Object.keys(rawData.passthroughs[0] || {}),
    hotPass: Object.keys(rawData.hotPass[0] || {}),
    bookings: Object.keys(rawData.bookings[0] || {}),
    nonConverted: Object.keys(rawData.nonConverted[0] || {}),
  };
};

// ============ Meeting Agenda Generation ============

// Extract program-to-destination associations from data for debugging
export const extractProgramDestinationAssociations = (rawData: RawParsedData): Record<string, string[]> => {
  console.log('=== HARDCODED PROGRAM-DESTINATION MAPPING (USED FOR FILTERING) ===');
  for (const [program, dests] of Object.entries(PROGRAM_DESTINATION_MAP)) {
    console.log(`${program}: ${dests.join(', ')}`);
  }
  console.log('=== END HARDCODED MAPPING ===\n');

  const associations: Record<string, Set<string>> = {};

  // Check trips data
  if (rawData.trips && rawData.trips.length > 0) {
    const programCol = findColumn(rawData.trips[0], ['us program', 'program', 'department', 'team', 'business unit']);
    const destCol = findColumn(rawData.trips[0], ['destination', 'region', 'country', 'original interest']);

    if (programCol && destCol) {
      for (const row of rawData.trips) {
        const program = (row[programCol] || '').trim();
        const dest = (row[destCol] || '').trim();
        if (program && dest) {
          if (!associations[program]) associations[program] = new Set();
          associations[program].add(dest);
        }
      }
    } else {
      console.warn('Program-Destination check: trips data missing columns', { programCol, destCol });
    }
  }

  // Check passthroughs data
  if (rawData.passthroughs && rawData.passthroughs.length > 0) {
    const programCol = findColumn(rawData.passthroughs[0], ['us program', 'program', 'department', 'team', 'business unit']);
    const destCol = findColumn(rawData.passthroughs[0], ['destination', 'region', 'country', 'original interest']);

    if (programCol && destCol) {
      for (const row of rawData.passthroughs) {
        const program = (row[programCol] || '').trim();
        const dest = (row[destCol] || '').trim();
        if (program && dest) {
          if (!associations[program]) associations[program] = new Set();
          associations[program].add(dest);
        }
      }
    }
  }

  // Convert Sets to sorted arrays
  const result: Record<string, string[]> = {};
  for (const [program, dests] of Object.entries(associations)) {
    result[program] = Array.from(dests).sort();
  }

  console.log('=== PROGRAM-DESTINATION ASSOCIATIONS FROM YOUR DATA (for reference) ===');
  for (const [program, dests] of Object.entries(result)) {
    console.log(`${program}: ${dests.join(', ')}`);
  }
  console.log('=== END DATA ASSOCIATIONS ===');

  return result;
};

// Extract US Programs - returns combined pairs (Canal & Asia, ESE & WEMEA)
export const extractUSPrograms = (rawData: RawParsedData): string[] => {
  // Check if we have destination data in any dataset to determine if programs are relevant
  const hasDestinationData = (rawData.trips?.length > 0 || rawData.passthroughs?.length > 0);
  if (!hasDestinationData) return [];

  // Return the individual program names from the hardcoded mapping
  return Object.keys(PROGRAM_DESTINATION_MAP).sort();
};

// Filter data by program(s) using hardcoded destination mapping
// program can be a single program name or multiple separated by " & "
export const filterDataByProgram = (
  rawData: RawParsedData,
  program: string
): RawParsedData => {
  // Split by " & " to support multi-program selection (e.g. "CANAL & ASIA")
  const programNames = program.split(' & ').map(p => p.trim().toUpperCase());

  // Collect all allowed destinations from all selected programs
  const allowedDestinations: string[] = [];
  for (const pName of programNames) {
    const dests = PROGRAM_DESTINATION_MAP[pName] || [];
    allowedDestinations.push(...dests);
  }
  const allowedDestLower = new Set(allowedDestinations.map(d => d.toLowerCase()));

  const filterByDestination = (rows: CSVRow[], datasetName: string): CSVRow[] => {
    if (!rows || rows.length === 0) return [];

    const destCol = findColumn(rows[0], ['destination', 'region', 'country', 'original interest']);
    if (!destCol) {
      console.warn(`No destination column found in ${datasetName} data.`);
      return [];
    }

    const filtered = rows.filter(row => {
      const dest = (row[destCol] || '').trim().toLowerCase();
      return allowedDestLower.has(dest);
    });

    return filtered;
  };

  return {
    trips: filterByDestination(rawData.trips, 'trips'),
    quotes: filterByDestination(rawData.quotes, 'quotes'),
    passthroughs: filterByDestination(rawData.passthroughs, 'passthroughs'),
    hotPass: filterByDestination(rawData.hotPass, 'hotPass'),
    bookings: filterByDestination(rawData.bookings, 'bookings'),
    nonConverted: filterByDestination(rawData.nonConverted, 'nonConverted'),
  };
};

// Generate meeting agenda
export interface DestinationOpportunity {
  region: string;
  currentRate: number;
  historicalRate: number;       // Previous quarter rate for this destination
  deviation: number;            // currentRate - historicalRate (pp)
  volume: number;               // trips (for TP), passthroughs (for PQ/HP)
  potentialGain: number;        // Concrete gain if matched prev qtr rate (extra PTs/quotes/HPs)
  volumeWeightedScore: number;  // For ranking: potentialGain (direct quantitative impact)
}

export interface ProgramStats {
  program: string;
  totalTrips: number;
  totalPassthroughs: number;
  tpRate: number;
  hotPassRate: number;
  pqRate: number;
}

// Per-department opportunity breakdown
export interface ProgramOpportunities {
  program: string;
  topBestTp: DestinationOpportunity[];    // Top 2 best T>P (outperforming prev qtr)
  tpNeeding: DestinationOpportunity[];    // Top 2 needing improvement T>P
  topBestPq: DestinationOpportunity[];    // Top 2 best P>Q
  pqNeeding: DestinationOpportunity[];    // Top 2 needing improvement P>Q
  topBestHp: DestinationOpportunity[];    // Top 2 best Hot Pass
  hpNeeding: DestinationOpportunity[];    // Top 2 needing improvement Hot Pass
}

// Per-department period-over-period trends (T>Q = quotes / trips)
export interface ProgramTrends {
  program: string;
  tqImproved: DestinationOpportunity[];   // Destinations where T>Q rate improved vs prev period
  tqDeclined: DestinationOpportunity[];   // Destinations where T>Q rate declined vs prev period
}

export interface TopHotPassDestination {
  region: string;
  hotPassRate: number;
  volume: number;       // passthroughs
  program?: string;     // which dept, when multiple selected
}

export interface SubRegionMetrics {
  subRegion: string;
  trips: number;
  passthroughs: number;
  hotPasses: number;
  quotes: number;
  tpRate: number;
  hotPassRate: number;
  pqRate: number;
}

export interface DepartmentSubRegionBreakdown {
  program: string;
  subRegions: SubRegionMetrics[];
}

export interface MeetingAgendaData {
  program: string;
  date: string;
  hotPassOpportunities: DestinationOpportunity[];   // Top Hot Pass improvement opps (QTD vs prev quarter)
  topHotPassDestinations: TopHotPassDestination[];   // Top 4 by HP rate (fallback when no significant changes)
  perProgramOpportunities: ProgramOpportunities[];  // Per-dept T>P and P>Q top/bottom
  programStats: ProgramStats[];                     // Per-department breakdown when multiple selected
  departmentSubRegions: DepartmentSubRegionBreakdown[];  // Sub-region breakdown per department
  perProgramTrends: ProgramTrends[];                     // Per-dept period-over-period trends
  currentPeriodLabel: string;                        // e.g., "This Quarter"
  previousPeriodLabel: string;                       // e.g., "Last Quarter"
  overallStats: {
    totalTrips: number;
    totalPassthroughs: number;
    tpRate: number;
    hotPassRate: number;
    pqRate: number;
  };
}

export const generateMeetingAgendaData = (
  rawData: RawParsedData,
  program: string,
  timeframe: MeetingTimeframePair = 'thisQuarter'
): MeetingAgendaData | null => {
  // Filter data by all selected programs combined
  const filteredData = filterDataByProgram(rawData, program);

  if (filteredData.trips.length === 0) {
    console.warn(`[MeetingAgenda] No trips after filtering for program "${program}"`);
    return null;
  }

  // Get the current and previous timeframe based on selected meeting timeframe
  const currentTimeframe: RegionalTimeframe = timeframe;
  const previousTimeframe: RegionalTimeframe = getPreviousTimeframe(timeframe);
  const tfOption = MEETING_TIMEFRAME_OPTIONS.find(o => o.value === timeframe);
  const currentPeriodLabel = tfOption?.label ?? 'This Quarter';
  const previousPeriodLabel = tfOption?.prevLabel ?? 'Last Quarter';

  // Use selected timeframe for current performance
  const regionalPerformance = analyzeRegionalPerformance(
    filteredData.trips, currentTimeframe, filteredData.hotPass, filteredData.quotes, filteredData.passthroughs
  );

  if (regionalPerformance.allRegions.length === 0) {
    console.warn(`[MeetingAgenda] No regions found after analysis for program "${program}"`);
    return null;
  }

  // Helper: build opportunity arrays ranked by potentialGain (quantitative impact)
  // potentialGain = extra conversions if destination matched its target rate
  // Target rate = max(prev period rate, department average rate) — this ensures
  // high-volume destinations with below-average rates surface even if they didn't
  // specifically decline from the previous period.
  const buildOpportunities = (
    qtdRegions: DepartmentRegionalPerformance['allRegions'],
    prevQtrLookup: Map<string, { tpRate: number; pqRate: number; hotPassRate: number }>,
    metricKey: 'tpRate' | 'pqRate' | 'hotPassRate',
    volumeKey: 'trips' | 'passthroughs',
    outputKey: 'passthroughs' | 'quotes' | 'hotPasses',
    minVolume: number,
    deptAvgRate: number,
    companyTarget?: number,  // If set, "needing" only includes destinations below this rate
  ): { best: DestinationOpportunity[]; needing: DestinationOpportunity[] } => {
    // Benchmark includes company target when provided
    const getTargetRate = (prevRate: number) =>
      companyTarget != null
        ? Math.max(prevRate, deptAvgRate, companyTarget)
        : Math.max(prevRate, deptAvgRate);

    const mapped = qtdRegions
      .filter(r => r[volumeKey] >= minVolume)
      .map(r => {
        const prev = prevQtrLookup.get(r.region);
        const prevRate = prev ? prev[metricKey] : 0;
        const deviation = r[metricKey] - prevRate;
        const targetRate = getTargetRate(prevRate);
        // potentialGain: how many more conversions if destination matched the target rate
        const potentialGain = Math.max(0, (targetRate / 100) * r[volumeKey] - r[outputKey]);
        return {
          region: r.region,
          currentRate: r[metricKey],
          historicalRate: prevRate,
          deviation,
          volume: r[volumeKey],
          potentialGain,
          volumeWeightedScore: potentialGain,
        };
      })
      .filter((o): o is DestinationOpportunity => o !== null);

    // Best: outperforming both prev period and dept average, ranked by surplus volume
    const bestMapped = qtdRegions
      .filter(r => r[volumeKey] >= minVolume)
      .map(r => {
        const prev = prevQtrLookup.get(r.region);
        const prevRate = prev ? prev[metricKey] : 0;
        const targetRate = getTargetRate(prevRate);
        const deviation = r[metricKey] - targetRate;
        if (deviation <= 0) return null;
        // Surplus: how many MORE conversions vs what target rate would have predicted
        const surplus = r[outputKey] - Math.max(0, (targetRate / 100) * r[volumeKey]);
        return {
          region: r.region,
          currentRate: r[metricKey],
          historicalRate: prevRate,
          deviation: r[metricKey] - prevRate,
          volume: r[volumeKey],
          potentialGain: Math.max(0, surplus),
          volumeWeightedScore: Math.max(0, surplus),
        };
      })
      .filter((o): o is DestinationOpportunity => o !== null && o.potentialGain > 0);

    const best = [...bestMapped]
      .sort((a, b) => b.volumeWeightedScore - a.volumeWeightedScore)
      .slice(0, 2);

    // Needing: below target rate, ranked by absolute potential gain
    // When companyTarget is set, exclude destinations already meeting the target
    const needing = [...mapped]
      .filter(o => {
        if (o.potentialGain <= 0) return false;
        if (companyTarget != null && o.currentRate >= companyTarget) return false;
        return true;
      })
      .sort((a, b) => b.potentialGain - a.potentialGain)
      .slice(0, 2);

    return { best, needing };
  };

  // Build T>Q period-over-period trends (quotes / trips, no dept avg benchmark)
  const buildTqTrends = (
    qtdRegions: DepartmentRegionalPerformance['allRegions'],
    prevRegions: DepartmentRegionalPerformance['allRegions'],
    minVolume: number,
  ): { improved: DestinationOpportunity[]; declined: DestinationOpportunity[] } => {
    const prevLookup = new Map<string, { tqRate: number }>();
    for (const r of prevRegions) {
      const tqRate = r.trips > 0 ? (r.quotes / r.trips) * 100 : 0;
      prevLookup.set(r.region, { tqRate });
    }

    const entries = qtdRegions
      .filter(r => r.trips >= minVolume)
      .map(r => {
        const currentTqRate = r.trips > 0 ? (r.quotes / r.trips) * 100 : 0;
        const prev = prevLookup.get(r.region);
        const prevRate = prev ? prev.tqRate : 0;
        const deviation = currentTqRate - prevRate;
        // potentialGain for declined: quotes lost if prev rate had been maintained
        const potentialGain = Math.max(0, (prevRate / 100) * r.trips - r.quotes);
        // surplus for improved: extra quotes vs what prev rate would have predicted
        const surplus = r.quotes - Math.max(0, (prevRate / 100) * r.trips);
        return {
          region: r.region,
          currentRate: currentTqRate,
          historicalRate: prevRate,
          deviation,
          volume: r.trips,
          potentialGain,
          volumeWeightedScore: Math.max(0, surplus),
        };
      });

    const improved = entries
      .filter(e => e.deviation > 1)
      .sort((a, b) => b.volumeWeightedScore - a.volumeWeightedScore)
      .slice(0, 3);

    const declined = entries
      .filter(e => e.deviation < -1)
      .sort((a, b) => b.potentialGain - a.potentialGain)
      .slice(0, 3);

    return { improved, declined };
  };

  // Build per-program opportunities
  const programNames = program.split(' & ').map(p => p.trim().toUpperCase());
  const perProgramOpportunities: ProgramOpportunities[] = [];
  const perProgramTrends: ProgramTrends[] = [];
  const programStats: ProgramStats[] = [];
  const topHotPassDestinations: TopHotPassDestination[] = [];

  for (const pName of programNames) {
    const pData = filterDataByProgram(rawData, pName);
    if (pData.trips.length === 0) continue;

    const pQtd = analyzeRegionalPerformance(pData.trips, currentTimeframe, pData.hotPass, pData.quotes, pData.passthroughs);
    const pPrev = analyzeRegionalPerformance(pData.trips, previousTimeframe, pData.hotPass, pData.quotes, pData.passthroughs);

    // Build prev quarter lookup for this program
    const pPrevLookup = new Map<string, { tpRate: number; pqRate: number; hotPassRate: number }>();
    for (const r of pPrev.allRegions) {
      pPrevLookup.set(r.region, { tpRate: r.tpRate, pqRate: r.pqRate, hotPassRate: r.hotPassRate });
    }

    const tp = buildOpportunities(pQtd.allRegions, pPrevLookup, 'tpRate', 'trips', 'passthroughs', 5, pQtd.overallTpRate);
    const pq = buildOpportunities(pQtd.allRegions, pPrevLookup, 'pqRate', 'passthroughs', 'quotes', 3, pQtd.overallPqRate, 65);
    const hp = buildOpportunities(pQtd.allRegions, pPrevLookup, 'hotPassRate', 'passthroughs', 'hotPasses', 3, pQtd.overallHotPassRate);

    perProgramOpportunities.push({
      program: pName,
      topBestTp: tp.best,
      tpNeeding: tp.needing,
      topBestPq: pq.best,
      pqNeeding: pq.needing,
      topBestHp: hp.best,
      hpNeeding: hp.needing,
    });

    // Period-over-period T>Q trends for this department (quotes / trips)
    const tqTrends = buildTqTrends(pQtd.allRegions, pPrev.allRegions, 5);

    perProgramTrends.push({
      program: pName,
      tqImproved: tqTrends.improved,
      tqDeclined: tqTrends.declined,
    });

    // Stats for overview slide (always build, even for single program)
    programStats.push({
      program: pName,
      totalTrips: pQtd.totalTrips,
      totalPassthroughs: pQtd.totalPassthroughs,
      tpRate: pQtd.overallTpRate,
      hotPassRate: pQtd.overallHotPassRate,
      pqRate: pQtd.overallPqRate,
    });

    // Top 2 hot pass destinations by rate for this dept (used as fallback)
    const perDeptTop = [...pQtd.allRegions]
      .filter(r => r.hotPasses > 0 && r.passthroughs >= 3)
      .sort((a, b) => b.hotPassRate - a.hotPassRate)
      .slice(0, 2)
      .map(r => ({
        region: r.region,
        hotPassRate: r.hotPassRate,
        volume: r.passthroughs,
        program: programNames.length > 1 ? pName : undefined,
      }));
    topHotPassDestinations.push(...perDeptTop);
  }

  // Sort all top hot pass destinations by rate descending, cap at 4
  topHotPassDestinations.sort((a, b) => b.hotPassRate - a.hotPassRate);
  topHotPassDestinations.splice(4);

  // Build sub-region breakdowns per department
  const departmentSubRegions: DepartmentSubRegionBreakdown[] = [];
  for (const pName of programNames) {
    const subRegionDef = SUBREGION_MAP[pName];
    if (!subRegionDef) continue;

    // Find this program's QTD performance (already computed above in programStats loop)
    const pData = filterDataByProgram(rawData, pName);
    if (pData.trips.length === 0) continue;
    const pQtd = analyzeRegionalPerformance(pData.trips, currentTimeframe, pData.hotPass, pData.quotes, pData.passthroughs);

    // Aggregate destinations into sub-regions
    const subRegionMetrics: SubRegionMetrics[] = [];
    for (const [srName, destinations] of Object.entries(subRegionDef)) {
      const destSet = new Set(destinations.map(d => d.toLowerCase()));
      const matchingRegions = pQtd.allRegions.filter(r => destSet.has(r.region.toLowerCase()));

      const trips = matchingRegions.reduce((sum, r) => sum + r.trips, 0);
      const passthroughs = matchingRegions.reduce((sum, r) => sum + r.passthroughs, 0);
      const hotPasses = matchingRegions.reduce((sum, r) => sum + r.hotPasses, 0);
      const quotes = matchingRegions.reduce((sum, r) => sum + r.quotes, 0);

      if (trips === 0 && passthroughs === 0) continue;

      subRegionMetrics.push({
        subRegion: srName,
        trips,
        passthroughs,
        hotPasses,
        quotes,
        tpRate: trips > 0 ? (passthroughs / trips) * 100 : 0,
        hotPassRate: passthroughs > 0 ? (hotPasses / passthroughs) * 100 : 0,
        pqRate: passthroughs > 0 ? (quotes / passthroughs) * 100 : 0,
      });
    }

    departmentSubRegions.push({
      program: pName,
      subRegions: subRegionMetrics.sort((a, b) => b.trips - a.trips),
    });
  }

  // Hot pass opportunities across all selected programs combined
  const prevPeriodPerformance = analyzeRegionalPerformance(
    filteredData.trips, previousTimeframe, filteredData.hotPass, filteredData.quotes, filteredData.passthroughs
  );
  const prevQtrLookupAll = new Map<string, { tpRate: number; pqRate: number; hotPassRate: number }>();
  for (const r of prevPeriodPerformance.allRegions) {
    prevQtrLookupAll.set(r.region, { tpRate: r.tpRate, pqRate: r.pqRate, hotPassRate: r.hotPassRate });
  }
  const hp = buildOpportunities(regionalPerformance.allRegions, prevQtrLookupAll, 'hotPassRate', 'passthroughs', 'hotPasses', 3, regionalPerformance.overallHotPassRate);

  return {
    program,
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    hotPassOpportunities: hp.needing,
    topHotPassDestinations,
    perProgramOpportunities,
    perProgramTrends,
    programStats,
    departmentSubRegions,
    currentPeriodLabel,
    previousPeriodLabel,
    overallStats: {
      totalTrips: regionalPerformance.totalTrips,
      totalPassthroughs: regionalPerformance.totalPassthroughs,
      tpRate: regionalPerformance.overallTpRate,
      hotPassRate: regionalPerformance.overallHotPassRate,
      pqRate: regionalPerformance.overallPqRate,
    },
  };
};

const formatOpportunities = (opps: DestinationOpportunity[], metricLabel: string, volumeLabel: string): string[] => {
  const lines: string[] = [];
  if (opps.length > 0) {
    opps.forEach((opp, i) => {
      lines.push(`  ${i + 1}. ${opp.region}`);
      lines.push(`     QTD: ${opp.currentRate.toFixed(1)}% vs Prev Qtr: ${opp.historicalRate.toFixed(1)}%`);
      lines.push(`     Gap: ${Math.abs(opp.deviation).toFixed(1)}pp | Volume: ${opp.volume} ${volumeLabel}`);
      if (opp.potentialGain > 0) {
        lines.push(`     Potential Gain: +${Math.round(opp.potentialGain)} ${metricLabel}`);
      }
      lines.push('');
    });
  } else {
    lines.push(`  No significant ${metricLabel} improvement opportunities identified.`);
    lines.push('');
  }
  return lines;
};

export const formatMeetingAgenda = (data: MeetingAgendaData): string => {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('         DEPARTMENT CHAMPS - REGIONAL PERFORMANCE');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Program: ${data.program}`);
  lines.push(`Date: ${data.date}`);
  lines.push(`Duration: 30 minutes`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                    DEPARTMENT OVERVIEW');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`Total Trips: ${data.overallStats.totalTrips.toLocaleString()}`);
  lines.push(`Total Passthroughs: ${data.overallStats.totalPassthroughs.toLocaleString()}`);
  lines.push(`T>P Rate: ${data.overallStats.tpRate.toFixed(1)}%`);
  lines.push(`Hot Pass Rate: ${data.overallStats.hotPassRate.toFixed(1)}%`);
  lines.push(`P>Q Rate: ${data.overallStats.pqRate.toFixed(1)}%`);
  if (data.programStats.length > 0) {
    lines.push('');
    for (const ps of data.programStats) {
      lines.push(`  ${ps.program}: ${ps.totalTrips} trips, ${ps.totalPassthroughs} PTs, T>P ${ps.tpRate.toFixed(1)}%, HP ${ps.hotPassRate.toFixed(1)}%, P>Q ${ps.pqRate.toFixed(1)}%`);
    }
  }
  lines.push('');

  // Per-department T>P and P>Q
  for (const po of data.perProgramOpportunities) {
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  T>P PERFORMANCE — ${po.program} (QTD vs Prev Quarter)`);
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('  Top Performing:');
    lines.push(...formatOpportunities(po.topBestTp, 'passthroughs', 'trips'));
    lines.push('  Opportunity Areas:');
    lines.push(...formatOpportunities(po.tpNeeding, 'passthroughs', 'trips'));

    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  P>Q PERFORMANCE — ${po.program} (QTD vs Prev Quarter)`);
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('  Top Performing:');
    lines.push(...formatOpportunities(po.topBestPq, 'quotes', 'passthroughs'));
    lines.push('  Opportunity Areas:');
    lines.push(...formatOpportunities(po.pqNeeding, 'quotes', 'passthroughs'));
  }

  // Hot Pass Opportunities (combined)
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  HOT PASS IMPROVEMENT OPPORTUNITIES (5 min)');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(...formatOpportunities(data.hotPassOpportunities, 'hot passes', 'passthroughs'));
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                     END OF AGENDA');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
};
