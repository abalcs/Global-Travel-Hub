import type { CSVRow } from './csvParser';
import type { RawParsedData } from './indexedDB';
import Anthropic from '@anthropic-ai/sdk';
import { parseDateTime as parseDateTimeUtil, parseDate as parseDateUtil, DAY_NAMES, TIME_SLOTS } from './dateParser';
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

// Create reverse lookup: destination -> program
export const DESTINATION_TO_PROGRAM: Record<string, string> = {};
for (const [program, destinations] of Object.entries(PROGRAM_DESTINATION_MAP)) {
  for (const dest of destinations) {
    DESTINATION_TO_PROGRAM[dest.toLowerCase()] = program;
  }
}

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

export type RegionalTimeframe = 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'lastYear' | 'all';

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

const isWithinTimeframe = (dateStr: string, startDate: Date | null, endDate?: Date | null): boolean => {
  if (!startDate && !endDate) return true; // 'all' timeframe
  const date = parseDate(dateStr);
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
};

export const analyzeRegionalPerformance = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all',
  hotPassData: CSVRow[] = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _quotesData: CSVRow[] = [] // Kept for backwards compatibility; P>Q now calculated from trips data
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
  // Check for quote first sent in trips data - more accurate P>Q calculation
  const tripsQuoteDateCol = findColumn(trips[0], ['quote first sent', 'first sent date']);

  if (!regionCol) {
    return emptyResult;
  }

  // Find region columns in hot pass data
  const hotPassRegionCol = hotPassData.length > 0
    ? findColumn(hotPassData[0], ['destination', 'region', 'country', 'original interest'])
    : null;
  const hotPassDateCol = hotPassData.length > 0
    ? findColumn(hotPassData[0], ['created date', 'enquiry date', 'trip created', 'date'])
    : null;

  // Group by region - include hot passes and quotes
  const regionStats: Record<string, { trips: number; passthroughs: number; hotPasses: number; quotes: number }> = {};

  // Excluded regions (case-insensitive matching)
  const excludedRegions = ['caribbean'];
  const isExcluded = (region: string) =>
    excludedRegions.some(excluded => region.toLowerCase().includes(excluded));

  // Process trips data
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

    // Check for passthrough
    const hasPassthrough = passthroughDateCol && (row[passthroughDateCol] || '').trim().length > 0;
    if (hasPassthrough) {
      regionStats[region].passthroughs++;

      // Check if this passthrough also has a quote (more accurate P>Q calculation)
      // A passthrough with a "quote first sent" date means it converted to a quote
      if (tripsQuoteDateCol) {
        const quoteDate = (row[tripsQuoteDateCol] || '').trim();
        if (quoteDate && quoteDate.length > 0) {
          regionStats[region].quotes++;
        }
      }
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

  // Note: Quotes are now counted from trips data directly (passthroughs with "quote first sent" date)
  // This provides a more accurate P>Q rate than counting rows from the quotes file,
  // which may contain multiple entries per trip (revisions, etc.)

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

  const totalTrips = allRegions.reduce((sum, r) => sum + r.trips, 0);
  const totalPassthroughs = allRegions.reduce((sum, r) => sum + r.passthroughs, 0);
  const totalHotPasses = allRegions.reduce((sum, r) => sum + r.hotPasses, 0);
  const totalQuotes = allRegions.reduce((sum, r) => sum + r.quotes, 0);
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
  performance: DepartmentRegionalPerformance
): DepartmentImprovementRecommendation[] => {
  if (performance.allRegions.length === 0) return [];

  const deptAvgRate = performance.overallTpRate;

  // Find regions performing below department average
  const belowAverage = performance.allRegions
    .filter(r => r.tpRate < deptAvgRate && r.trips >= 3)
    .map(r => {
      const deviation = r.tpRate - deptAvgRate;
      // Calculate potential gain: if this region matched dept avg, how many more passthroughs?
      const expectedPassthroughs = (deptAvgRate / 100) * r.trips;
      const potentialGain = Math.max(0, expectedPassthroughs - r.passthroughs);

      // Impact score: prioritizes potential gain (actual training lift)
      // Primary factor: potential passthroughs gained
      // Secondary factor: volume × gap (training opportunity size)
      const impactScore = (potentialGain * 10) + (r.trips * Math.abs(deviation) / 100);

      return {
        region: r.region,
        tpRate: r.tpRate,
        departmentAvgRate: deptAvgRate,
        deviation,
        trips: r.trips,
        passthroughs: r.passthroughs,
        potentialGain,
        impactScore,
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore);

  // Generate recommendations with priorities based on potential training lift
  return belowAverage.slice(0, 5).map((r) => {
    let priority: 'high' | 'medium' | 'low';
    // Priority based on potential gain and volume
    if (r.potentialGain >= 10 || (r.trips >= 100 && r.potentialGain >= 5)) {
      priority = 'high';
    } else if (r.potentialGain >= 5 || r.trips >= 50) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Generate reason focused on training impact
    let reason: string;
    const deviationAbs = Math.abs(r.deviation).toFixed(1);
    const potentialGainRounded = Math.round(r.potentialGain);

    if (r.trips >= 100 && potentialGainRounded >= 10) {
      reason = `High-impact training opportunity: ${r.trips} trips with ${deviationAbs}pp gap. Training here could yield ~${potentialGainRounded} additional passthroughs.`;
    } else if (r.trips >= 100) {
      reason = `High-volume region (${r.trips} trips). Training focus here maximizes reach - could gain ~${potentialGainRounded} passthroughs.`;
    } else if (potentialGainRounded >= 5) {
      reason = `Training opportunity: ~${potentialGainRounded} potential passthroughs by closing the ${deviationAbs}pp gap.`;
    } else if (Math.abs(r.deviation) > 15) {
      reason = `Significant skill gap of ${deviationAbs}pp. Consider targeted training for this destination.`;
    } else {
      reason = `${r.trips} trips at ${deviationAbs}pp below average. Incremental training gains available.`;
    }

    return {
      ...r,
      priority,
      reason,
    };
  });
};

// Generate P>Q improvement recommendations (volume-weighted like T>P)
export const generatePqDepartmentRecommendations = (
  performance: DepartmentRegionalPerformance
): DepartmentImprovementRecommendation[] => {
  if (performance.allRegions.length === 0 || performance.totalPassthroughs === 0) return [];

  const deptAvgRate = performance.overallPqRate;

  // Find regions with below-average P>Q rate (need at least 3 passthroughs for meaningful analysis)
  const belowAverage = performance.allRegions
    .filter(r => r.passthroughs >= 3 && r.pqRate < deptAvgRate)
    .map(r => {
      const deviation = r.pqRate - deptAvgRate;
      // Calculate potential gain: if this region matched dept avg P>Q, how many more quotes?
      const expectedQuotes = (deptAvgRate / 100) * r.passthroughs;
      const potentialGain = Math.max(0, expectedQuotes - r.quotes);

      // Impact score: prioritizes potential gain (actual training lift for quotes)
      // Primary factor: potential quotes gained
      // Secondary factor: volume × gap (training opportunity size)
      const impactScore = (potentialGain * 10) + (r.passthroughs * Math.abs(deviation) / 100);

      return {
        region: r.region,
        tpRate: r.pqRate, // Using tpRate field to store P>Q rate for compatibility
        departmentAvgRate: deptAvgRate,
        deviation,
        trips: r.passthroughs, // Using trips field to store passthroughs for compatibility
        passthroughs: r.quotes, // Using passthroughs field to store quotes for compatibility
        potentialGain,
        impactScore,
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore);

  // Generate recommendations with priorities based on potential training lift
  return belowAverage.slice(0, 5).map((r) => {
    let priority: 'high' | 'medium' | 'low';
    // Priority based on potential gain and volume (passthroughs)
    if (r.potentialGain >= 8 || (r.trips >= 50 && r.potentialGain >= 4)) {
      priority = 'high';
    } else if (r.potentialGain >= 4 || r.trips >= 25) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Generate reason focused on training impact for P>Q
    let reason: string;
    const deviationAbs = Math.abs(r.deviation).toFixed(1);
    const potentialGainRounded = Math.round(r.potentialGain);

    if (r.trips >= 50 && potentialGainRounded >= 8) {
      reason = `High-impact quoting opportunity: ${r.trips} passthroughs with ${deviationAbs}pp P>Q gap. Focus here could yield ~${potentialGainRounded} additional quotes.`;
    } else if (r.trips >= 50) {
      reason = `High-volume destination (${r.trips} passthroughs). Training focus here maximizes quote potential - could gain ~${potentialGainRounded} quotes.`;
    } else if (potentialGainRounded >= 4) {
      reason = `Quoting opportunity: ~${potentialGainRounded} potential quotes by closing the ${deviationAbs}pp P>Q gap.`;
    } else if (Math.abs(r.deviation) > 15) {
      reason = `Significant P>Q gap of ${deviationAbs}pp. Consider quoting skills training for this destination.`;
    } else {
      reason = `${r.trips} passthroughs at ${deviationAbs}pp below P>Q average. Incremental quoting gains available.`;
    }

    return {
      ...r,
      priority,
      reason,
    };
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

export const generateInsightsData = (rawData: RawParsedData): InsightsData => {
  const passthroughsByDay = analyzePassthroughsByDay(rawData.passthroughs);
  const passthroughsByTime = analyzePassthroughsByTime(rawData.passthroughs);
  const hotPassByDay = analyzeHotPassByDay(rawData.hotPass);
  const hotPassByTime = analyzeHotPassByTime(rawData.hotPass);
  const topNonValidatedReasons = analyzeNonValidatedReasons(rawData.nonConverted);
  const agentNonValidated = analyzeNonValidatedByAgent(rawData.nonConverted);
  const bookingCorrelations = analyzeBookingCorrelations(
    rawData.hotPass,
    rawData.bookings,
    rawData.passthroughs
  );

  // Regional performance analysis
  const departmentRegionalPerformance = analyzeRegionalPerformance(rawData.trips, 'all', rawData.hotPass, rawData.quotes);
  const agentRegionalPerformance = analyzeRegionalPerformanceByAgent(rawData.trips, 'all');
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
    hasBookingData: rawData.bookings.length > 0,
    totalPassthroughs: rawData.passthroughs.length,
    totalNonValidated: rawData.nonConverted.length,
    totalBookings: rawData.bookings.length,
    totalHotPass: rawData.hotPass.length,
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

// Extract unique US Programs from passthrough data
export const extractUSPrograms = (rawData: RawParsedData): string[] => {
  const passthroughs = rawData.passthroughs;
  if (!passthroughs || passthroughs.length === 0) return [];

  // Find the program column
  const programCol = findColumn(passthroughs[0], ['us program', 'program', 'department', 'team', 'business unit']);
  if (!programCol) return [];

  // Extract unique programs
  const programs = new Set<string>();
  for (const row of passthroughs) {
    const program = (row[programCol] || '').trim();
    if (program && program.length > 0) {
      programs.add(program);
    }
  }

  return Array.from(programs).sort();
};

// Filter data by program using hardcoded destination mapping
export const filterDataByProgram = (
  rawData: RawParsedData,
  program: string
): RawParsedData => {
  // Get allowed destinations for this program from the hardcoded mapping
  const allowedDestinations = PROGRAM_DESTINATION_MAP[program.toUpperCase()] || [];
  const allowedDestLower = new Set(allowedDestinations.map(d => d.toLowerCase()));

  const filterByDestination = (rows: CSVRow[], datasetName: string): CSVRow[] => {
    if (!rows || rows.length === 0) return [];

    // Find the destination column
    const destCol = findColumn(rows[0], ['destination', 'region', 'country', 'original interest']);

    if (!destCol) {
      console.warn(`No destination column found in ${datasetName} data.`);
      return [];
    }

    // Filter to only rows where destination matches the program's allowed destinations
    const filtered = rows.filter(row => {
      const dest = (row[destCol] || '').trim().toLowerCase();
      return allowedDestLower.has(dest);
    });

    console.log(`Filtered ${datasetName} by destination: ${filtered.length} of ${rows.length} rows for program "${program}" (${allowedDestinations.length} allowed destinations)`);
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
export interface MeetingAgendaData {
  program: string;
  date: string;
  tpRecommendations: DepartmentImprovementRecommendation[];
  pqRecommendations: DepartmentImprovementRecommendation[];
  topTpDestinations: Array<{ region: string; tpRate: number; trips: number; passthroughs: number }>;
  topPqDestinations: Array<{ region: string; pqRate: number; passthroughs: number; quotes: number }>;
  topAgents: Array<{ name: string; tpRate: number; trips: number; regions: string[] }>;
  bottomAgents: Array<{ name: string; tpRate: number; trips: number; focusRegions: string[] }>;
  overallStats: {
    totalTrips: number;
    totalPassthroughs: number;
    tpRate: number;
    hotPassRate: number;
    pqRate: number;
    destinationsTracked: number;
  };
}

export const generateMeetingAgendaData = (
  rawData: RawParsedData,
  program: string,
  timeframe: RegionalTimeframe = 'all'
): MeetingAgendaData | null => {
  // Filter data by program
  const filteredData = filterDataByProgram(rawData, program);

  if (filteredData.trips.length === 0) {
    return null;
  }

  // Analyze regional performance
  const regionalPerformance = analyzeRegionalPerformance(
    filteredData.trips,
    timeframe,
    filteredData.hotPass,
    filteredData.quotes
  );

  if (regionalPerformance.allRegions.length === 0) {
    return null;
  }

  // Get recommendations
  const tpRecommendations = generateDepartmentRecommendations(regionalPerformance);
  const pqRecommendations = generatePqDepartmentRecommendations(regionalPerformance);

  // Analyze agent performance
  const agentRegionalAnalysis = analyzeAgentRegionalDeviations(
    filteredData.trips,
    regionalPerformance,
    timeframe
  );

  // Get top and bottom agents by overall T>P rate
  const sortedAgents = [...agentRegionalAnalysis].sort((a, b) => b.overallTpRate - a.overallTpRate);

  const topAgents = sortedAgents.slice(0, 3).map(agent => ({
    name: agent.agentName,
    tpRate: agent.overallTpRate,
    trips: agent.totalTrips,
    regions: agent.aboveAverage.slice(0, 3).map(r => r.region),
  }));

  const bottomAgents = sortedAgents.slice(-3).reverse().map(agent => ({
    name: agent.agentName,
    tpRate: agent.overallTpRate,
    trips: agent.totalTrips,
    focusRegions: agent.recommendations.slice(0, 3).map(r => r.region),
  }));

  // Get top destinations for T>P (sorted by T>P rate, descending)
  const topTpDestinations = [...regionalPerformance.allRegions]
    .filter(r => r.trips >= 10) // Minimum volume threshold
    .sort((a, b) => b.tpRate - a.tpRate)
    .slice(0, 5)
    .map(r => ({
      region: r.region,
      tpRate: r.tpRate,
      trips: r.trips,
      passthroughs: r.passthroughs,
    }));

  // Get top destinations for P>Q (sorted by P>Q rate, descending)
  const topPqDestinations = [...regionalPerformance.allRegions]
    .filter(r => r.passthroughs >= 5) // Minimum volume threshold
    .sort((a, b) => b.pqRate - a.pqRate)
    .slice(0, 5)
    .map(r => ({
      region: r.region,
      pqRate: r.pqRate,
      passthroughs: r.passthroughs,
      quotes: r.quotes,
    }));

  return {
    program,
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    tpRecommendations: tpRecommendations.slice(0, 3),
    pqRecommendations: pqRecommendations.slice(0, 3),
    topTpDestinations,
    topPqDestinations,
    topAgents,
    bottomAgents,
    overallStats: {
      totalTrips: regionalPerformance.totalTrips,
      totalPassthroughs: regionalPerformance.totalPassthroughs,
      tpRate: regionalPerformance.overallTpRate,
      hotPassRate: regionalPerformance.overallHotPassRate,
      pqRate: regionalPerformance.overallPqRate,
      destinationsTracked: regionalPerformance.allRegions.length,
    },
  };
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
  lines.push(`Destinations Tracked: ${data.overallStats.destinationsTracked}`);
  lines.push('');

  // T>P Opportunities (10 min)
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  1. T>P IMPROVEMENT OPPORTUNITIES (10 min)');
  lines.push('───────────────────────────────────────────────────────────────');
  if (data.tpRecommendations.length > 0) {
    data.tpRecommendations.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec.region}`);
      lines.push(`     Current: ${rec.tpRate.toFixed(1)}% vs Dept Avg: ${rec.departmentAvgRate.toFixed(1)}%`);
      lines.push(`     Gap: ${Math.abs(rec.deviation).toFixed(1)}pp | Volume: ${rec.trips} trips`);
      lines.push(`     Potential Gain: +${Math.round(rec.potentialGain)} passthroughs`);
      lines.push('');
    });
  } else {
    lines.push('  No significant T>P improvement opportunities identified.');
    lines.push('');
  }

  // P>Q Opportunities (5 min)
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  2. P>Q IMPROVEMENT OPPORTUNITIES (5 min)');
  lines.push('───────────────────────────────────────────────────────────────');
  if (data.pqRecommendations.length > 0) {
    data.pqRecommendations.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec.region}`);
      lines.push(`     Current: ${rec.tpRate.toFixed(1)}% vs Dept Avg: ${rec.departmentAvgRate.toFixed(1)}%`);
      lines.push(`     Gap: ${Math.abs(rec.deviation).toFixed(1)}pp | Volume: ${rec.trips} passthroughs`);
      lines.push(`     Potential Gain: +${Math.round(rec.potentialGain)} quotes`);
      lines.push('');
    });
  } else {
    lines.push('  No significant P>Q improvement opportunities identified.');
    lines.push('');
  }

  // Agent Performance (10 min)
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  3. AGENT PERFORMANCE HIGHLIGHTS (10 min)');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('  TOP PERFORMERS:');
  if (data.topAgents.length > 0) {
    data.topAgents.forEach((agent, i) => {
      lines.push(`  ${i + 1}. ${agent.name}`);
      lines.push(`     T>P Rate: ${agent.tpRate.toFixed(1)}% | Trips: ${agent.trips}`);
      if (agent.regions.length > 0) {
        lines.push(`     Strong Regions: ${agent.regions.join(', ')}`);
      }
      lines.push('');
    });
  } else {
    lines.push('  No agent data available.');
    lines.push('');
  }

  lines.push('  DEVELOPMENT FOCUS:');
  if (data.bottomAgents.length > 0) {
    data.bottomAgents.forEach((agent, i) => {
      lines.push(`  ${i + 1}. ${agent.name}`);
      lines.push(`     T>P Rate: ${agent.tpRate.toFixed(1)}% | Trips: ${agent.trips}`);
      if (agent.focusRegions.length > 0) {
        lines.push(`     Focus Regions: ${agent.focusRegions.join(', ')}`);
      }
      lines.push('');
    });
  } else {
    lines.push('  No agent data available.');
    lines.push('');
  }

  // Actions (5 min)
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  4. ACTIONS & NEXT STEPS (5 min)');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('  □ Review training materials for focus destinations');
  lines.push('  □ Schedule 1:1s with development focus agents');
  lines.push('  □ Share best practices from top performers');
  lines.push('  □ Update destination knowledge resources');
  lines.push('  □ Set improvement targets for next review');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                     END OF AGENDA');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
};
