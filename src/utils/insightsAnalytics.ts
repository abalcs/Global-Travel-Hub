import type { CSVRow } from './csvParser';
import type { RawParsedData } from './indexedDB';
import Anthropic from '@anthropic-ai/sdk';

// ============ Date/Time Parsing ============

interface ParsedDateTime {
  date: Date;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  hour: number;
  timeSlot: string; // "Morning", "Afternoon", etc.
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
  { name: 'Early Morning (6-9am)', start: 6, end: 9 },
  { name: 'Morning (9am-12pm)', start: 9, end: 12 },
  { name: 'Afternoon (12-3pm)', start: 12, end: 15 },
  { name: 'Late Afternoon (3-6pm)', start: 15, end: 18 },
  { name: 'Evening (6-9pm)', start: 18, end: 21 },
  { name: 'Night (9pm-6am)', start: 21, end: 6 },
];

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

const parseDateTime = (value: string): ParsedDateTime | null => {
  if (!value || value.trim() === '') return null;

  // Try Excel serial number with time (includes decimal for time)
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
    if (!isNaN(jsDate.getTime())) {
      return {
        date: jsDate,
        dayOfWeek: jsDate.getDay(),
        dayName: DAY_NAMES[jsDate.getDay()],
        hour: jsDate.getHours(),
        timeSlot: getTimeSlot(jsDate.getHours()),
      };
    }
  }

  // Try standard date string
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return {
      date: parsed,
      dayOfWeek: parsed.getDay(),
      dayName: DAY_NAMES[parsed.getDay()],
      hour: parsed.getHours(),
      timeSlot: getTimeSlot(parsed.getHours()),
    };
  }

  return null;
};

// ============ Column Detection ============

const findColumn = (row: CSVRow, patterns: string[]): string | null => {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const found = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
    if (found) return found;
  }
  return null;
};

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

export type RegionalTimeframe = 'week' | 'month' | 'quarter' | 'ytd' | 'all';

export interface RegionalPerformance {
  region: string;
  trips: number;
  passthroughs: number;
  tpRate: number;
}

export interface AgentRegionalPerformance {
  agentName: string;
  topRegions: RegionalPerformance[];
  bottomRegions: RegionalPerformance[];
  totalTrips: number;
  totalPassthroughs: number;
  overallTpRate: number;
}

export interface DepartmentRegionalPerformance {
  topRegions: RegionalPerformance[];
  bottomRegions: RegionalPerformance[];
  allRegions: RegionalPerformance[];
  totalTrips: number;
  totalPassthroughs: number;
  overallTpRate: number;
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

const getTimeframeStartDate = (timeframe: RegionalTimeframe): Date | null => {
  const now = new Date();
  switch (timeframe) {
    case 'week':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case 'quarter':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1);
    case 'all':
      return null;
    default:
      return null;
  }
};

const parseDate = (value: string): Date | null => {
  if (!value || value.trim() === '') return null;

  // Try Excel serial number
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
  }

  // Try standard date string
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
};

const isWithinTimeframe = (dateStr: string, startDate: Date | null): boolean => {
  if (!startDate) return true; // 'all' timeframe
  const date = parseDate(dateStr);
  if (!date) return false;
  return date >= startDate;
};

export const analyzeRegionalPerformance = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all'
): DepartmentRegionalPerformance => {
  if (trips.length === 0) {
    return {
      topRegions: [],
      bottomRegions: [],
      allRegions: [],
      totalTrips: 0,
      totalPassthroughs: 0,
      overallTpRate: 0,
    };
  }

  const startDate = getTimeframeStartDate(timeframe);

  // Find relevant columns
  const regionCol = findColumn(trips[0], ['original interest', 'region', 'country', 'destination']);
  const passthroughDateCol = findColumn(trips[0], ['passthrough to sales date', 'passthrough date']);
  const dateCol = findColumn(trips[0], ['created date', 'trip: created date', 'date']);

  if (!regionCol) {
    return {
      topRegions: [],
      bottomRegions: [],
      allRegions: [],
      totalTrips: 0,
      totalPassthroughs: 0,
      overallTpRate: 0,
    };
  }

  // Group by region
  const regionStats: Record<string, { trips: number; passthroughs: number }> = {};

  for (const row of trips) {
    const region = (row[regionCol] || '').trim();
    if (!region || region.length < 2) continue;

    // Check timeframe filter
    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate)) continue;

    if (!regionStats[region]) {
      regionStats[region] = { trips: 0, passthroughs: 0 };
    }

    regionStats[region].trips++;

    // Check if there's a passthrough date (indicates a passthrough)
    if (passthroughDateCol) {
      const passthroughDate = (row[passthroughDateCol] || '').trim();
      if (passthroughDate && passthroughDate.length > 0) {
        regionStats[region].passthroughs++;
      }
    }
  }

  // Convert to array and calculate rates
  const allRegions: RegionalPerformance[] = Object.entries(regionStats)
    .filter(([_, stats]) => stats.trips >= 3) // Minimum threshold for meaningful rate
    .map(([region, stats]) => ({
      region,
      trips: stats.trips,
      passthroughs: stats.passthroughs,
      tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
    }))
    .sort((a, b) => b.tpRate - a.tpRate);

  const totalTrips = allRegions.reduce((sum, r) => sum + r.trips, 0);
  const totalPassthroughs = allRegions.reduce((sum, r) => sum + r.passthroughs, 0);

  return {
    topRegions: allRegions.slice(0, 5),
    bottomRegions: allRegions.slice(-5).reverse(),
    allRegions,
    totalTrips,
    totalPassthroughs,
    overallTpRate: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
  };
};

export const analyzeRegionalPerformanceByAgent = (
  trips: CSVRow[],
  timeframe: RegionalTimeframe = 'all'
): AgentRegionalPerformance[] => {
  if (trips.length === 0) return [];

  const startDate = getTimeframeStartDate(timeframe);

  // Find relevant columns
  const regionCol = findColumn(trips[0], ['original interest', 'region', 'country', 'destination']);
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

  // Group by agent then region
  const agentStats: Record<string, Record<string, { trips: number; passthroughs: number }>> = {};
  let currentAgent = '';

  for (const row of trips) {
    const agent = (row[agentCol] || '').trim();
    if (agent && !/^\d+$/.test(agent)) currentAgent = agent;
    if (!currentAgent) continue;

    const region = (row[regionCol] || '').trim();
    if (!region || region.length < 2) continue;

    // Check timeframe filter
    const rowDate = dateCol ? row[dateCol] : '';
    if (!isWithinTimeframe(rowDate, startDate)) continue;

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
        .filter(([_, stats]) => stats.trips >= 2) // Lower threshold per agent
        .map(([region, stats]) => ({
          region,
          trips: stats.trips,
          passthroughs: stats.passthroughs,
          tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
        }))
        .sort((a, b) => b.tpRate - a.tpRate);

      const totalTrips = regionPerf.reduce((sum, r) => sum + r.trips, 0);
      const totalPassthroughs = regionPerf.reduce((sum, r) => sum + r.passthroughs, 0);

      return {
        agentName,
        topRegions: regionPerf.slice(0, 3),
        bottomRegions: regionPerf.filter(r => r.trips >= 2).slice(-3).reverse(),
        totalTrips,
        totalPassthroughs,
        overallTpRate: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
      };
    })
    .filter(a => a.totalTrips >= 5) // Only agents with meaningful data
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
  const regionCol = findColumn(trips[0], ['original interest', 'region', 'country', 'destination']);
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
      .filter(([_, stats]) => stats.trips >= 3)
      .map(([region, stats]) => ({
        region,
        trips: stats.trips,
        passthroughs: stats.passthroughs,
        tpRate: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
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
  const departmentRegionalPerformance = analyzeRegionalPerformance(rawData.trips, 'all');
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
