import type { Metrics } from '../types';
import type { CSVRow } from './csvParser';
import type { AgentTimeSeries, DailyAgentMetrics, TimeSeriesData } from '../types';

// Optimized single-pass counting with date support
export interface CountResult {
  total: Map<string, number>;
  byDate: Map<string, Map<string, number>>;
}

const parseDate = (value: string): string | null => {
  if (!value || value.trim() === '') return null;

  // Try parsing as Excel serial number
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
    if (!isNaN(jsDate.getTime())) {
      return formatDate(jsDate);
    }
  }

  // Try parsing as standard date string
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }

  // Try MM/DD/YYYY format
  const parts = value.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return formatDate(date);
    }
  }

  return null;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Find agent column - optimized with early return
export const findAgentColumn = (row: CSVRow): string | null => {
  if (!row) return null;

  // Check _agent first (from grouped reports)
  if (row['_agent'] !== undefined) return '_agent';

  const keys = Object.keys(row);

  // Priority patterns
  for (const key of keys) {
    const k = key.toLowerCase();
    if (k.includes('gtt owner') || k.includes('owner name') || k.includes('last gtt action by')) {
      return key;
    }
  }

  // Exact matches
  const exactMatches = ['agent', 'agent name', 'agentname', 'agent_name', 'name', 'rep'];
  for (const match of exactMatches) {
    if (row[match] !== undefined) return match;
  }

  // Partial matches
  for (const key of keys) {
    const k = key.toLowerCase();
    if (k.includes('agent') || k.includes('owner') || k.includes('rep')) {
      return key;
    }
  }

  return keys[0] || null;
};

// Find date column
export const findDateColumn = (row: CSVRow, patterns: string[]): string | null => {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const found = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
    if (found) return found;
  }
  return null;
};

// Optimized counting with single pass for both total and by-date
export const countByAgentOptimized = (
  rows: CSVRow[],
  agentColumn: string,
  dateColumn: string | null,
  startDate: string,
  endDate: string
): CountResult => {
  const total = new Map<string, number>();
  const byDate = new Map<string, Map<string, number>>();

  const startTime = startDate ? new Date(startDate).getTime() : null;
  const endTime = endDate ? new Date(endDate + 'T23:59:59').getTime() : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const agent = row[agentColumn];
    if (!agent) continue;

    // Parse and filter by date if needed
    let dateStr: string | null = null;
    if (dateColumn && row[dateColumn]) {
      dateStr = parseDate(row[dateColumn]);

      // Apply date filter
      if (dateStr && (startTime || endTime)) {
        const rowTime = new Date(dateStr).getTime();
        if (startTime && rowTime < startTime) continue;
        if (endTime && rowTime > endTime) continue;
      }
    }

    // Count total
    total.set(agent, (total.get(agent) || 0) + 1);

    // Count by date
    if (dateStr) {
      if (!byDate.has(agent)) {
        byDate.set(agent, new Map());
      }
      const agentDates = byDate.get(agent)!;
      agentDates.set(dateStr, (agentDates.get(dateStr) || 0) + 1);
    }
  }

  return { total, byDate };
};

// Build a map of trip names to their dates
export const buildTripDateMap = (
  tripsRows: CSVRow[],
  tripNameCol: string | null,
  dateColumn: string | null
): Map<string, string> => {
  const tripDateMap = new Map<string, string>();
  if (!tripNameCol || !dateColumn) return tripDateMap;

  for (const row of tripsRows) {
    const tripName = (row[tripNameCol] || '').trim().toLowerCase();
    const dateValue = row[dateColumn];
    if (tripName && dateValue) {
      const dateStr = parseDate(dateValue);
      if (dateStr) {
        tripDateMap.set(tripName, dateStr);
      }
    }
  }
  return tripDateMap;
};

// Count non-converted with date filtering (special logic for grouped format)
// Can filter by direct date column OR by matching trip names to trip dates
export const countNonConvertedOptimized = (
  rows: CSVRow[],
  dateColumn: string | null,
  startDate: string,
  endDate: string,
  tripDateMap?: Map<string, string>
): Map<string, number> => {
  const counts = new Map<string, number>();

  if (rows.length === 0) return counts;

  // Find columns
  const keys = Object.keys(rows[0] || {});
  const leadOwnerCol = keys.find(k =>
    k.includes('lead owner') || k.includes('_agent')
  );
  const nonValidatedCol = keys.find(k =>
    k.includes('non validated reason')
  );
  const tripNameCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('trip name') ||
      lower.includes('trip:') ||
      lower === 'trip' ||
      lower.includes('opportunity') ||
      lower.includes('lead name') ||
      lower === 'name';
  });

  if (!leadOwnerCol || !nonValidatedCol) return counts;

  const startTime = startDate ? new Date(startDate).getTime() : null;
  const endTime = endDate ? new Date(endDate + 'T23:59:59').getTime() : null;
  const hasDateFilter = startTime || endTime;

  // Debug logging
  console.log('countNonConvertedOptimized - dateColumn:', dateColumn);
  console.log('countNonConvertedOptimized - hasDateFilter:', hasDateFilter);
  console.log('countNonConvertedOptimized - startTime:', startTime, 'endTime:', endTime);

  // Log sample raw date values
  if (dateColumn && rows.length > 0) {
    const sampleRawDates = rows.slice(0, 5).map(r => r[dateColumn]).filter(d => d);
    console.log('Sample raw date values from column:', sampleRawDates);
    if (sampleRawDates.length > 0) {
      const testParsed = parseDate(sampleRawDates[0]);
      console.log('First date parsed as:', testParsed);
    }
  }

  let currentAgent = '';
  let debugParsedCount = 0;
  let debugInRangeCount = 0;
  let debugOutOfRangeCount = 0;
  let debugNoDateCount = 0;

  for (const row of rows) {
    const leadOwner = (row[leadOwnerCol] || '').trim();
    const nonValidatedReason = (row[nonValidatedCol] || '').trim();

    // Track current agent (grouped report format)
    if (leadOwner && leadOwner !== '') {
      currentAgent = leadOwner;
    }

    // Only count if there's a non-validated reason
    if (!currentAgent || !nonValidatedReason || nonValidatedReason === '') {
      continue;
    }

    // Apply date filter
    if (hasDateFilter) {
      let dateStr: string | null = null;

      // First try: direct date column
      if (dateColumn && row[dateColumn]) {
        dateStr = parseDate(row[dateColumn]);
        if (dateStr) debugParsedCount++;
      }

      // Second try: match trip name to trip dates
      if (!dateStr && tripNameCol && tripDateMap && tripDateMap.size > 0) {
        const tripName = (row[tripNameCol] || '').trim().toLowerCase();
        if (tripName) {
          dateStr = tripDateMap.get(tripName) || null;
        }
      }

      // Apply date filter if we found a date
      if (dateStr) {
        const rowTime = new Date(dateStr).getTime();
        if (startTime && rowTime < startTime) {
          debugOutOfRangeCount++;
          continue;
        }
        if (endTime && rowTime > endTime) {
          debugOutOfRangeCount++;
          continue;
        }
        debugInRangeCount++;
      } else {
        // No date found - can't filter this row, so skip it when date filter is active
        debugNoDateCount++;
        continue;
      }
    }

    counts.set(currentAgent, (counts.get(currentAgent) || 0) + 1);
  }

  // Log debug info
  if (hasDateFilter) {
    console.log('countNonConvertedOptimized results:');
    console.log('  - Dates parsed successfully:', debugParsedCount);
    console.log('  - In date range:', debugInRangeCount);
    console.log('  - Out of date range:', debugOutOfRangeCount);
    console.log('  - No date found:', debugNoDateCount);
    console.log('  - Final count:', Array.from(counts.values()).reduce((a, b) => a + b, 0));
  }

  return counts;
};

// Calculate all metrics in a single pass
export const calculateMetrics = (
  tripsCounts: Map<string, number>,
  quotesCounts: Map<string, number>,
  passthroughsCounts: Map<string, number>,
  hotPassCounts: Map<string, number>,
  bookingsCounts: Map<string, number>,
  nonConvertedCounts: Map<string, number>
): Metrics[] => {
  // Get all unique agents
  const allAgents = new Set<string>();
  [tripsCounts, quotesCounts, passthroughsCounts, bookingsCounts, nonConvertedCounts].forEach(m => {
    m.forEach((_, agent) => allAgents.add(agent));
  });

  const metrics: Metrics[] = [];

  for (const agentName of allAgents) {
    const trips = tripsCounts.get(agentName) || 0;
    const quotes = quotesCounts.get(agentName) || 0;
    const passthroughs = passthroughsCounts.get(agentName) || 0;
    const hotPasses = hotPassCounts.get(agentName) || 0;
    const bookings = bookingsCounts.get(agentName) || 0;

    // Try to find matching agent in nonConvertedCounts (case-insensitive)
    let nonConvertedCount = nonConvertedCounts.get(agentName) || 0;
    if (nonConvertedCount === 0) {
      const agentNameLower = agentName.toLowerCase().trim();
      for (const [key, value] of nonConvertedCounts.entries()) {
        if (key.toLowerCase().trim() === agentNameLower) {
          nonConvertedCount = value;
          break;
        }
      }
    }

    metrics.push({
      agentName,
      trips,
      quotes,
      passthroughs,
      hotPasses,
      bookings,
      nonConvertedLeads: nonConvertedCount,
      totalLeads: trips, // Use filtered trips count for the date range
      quotesFromTrips: trips > 0 ? (quotes / trips) * 100 : 0,
      passthroughsFromTrips: trips > 0 ? (passthroughs / trips) * 100 : 0,
      quotesFromPassthroughs: passthroughs > 0 ? (quotes / passthroughs) * 100 : 0,
      hotPassRate: passthroughs > 0 ? (hotPasses / passthroughs) * 100 : 0,
      nonConvertedRate: trips > 0 ? (nonConvertedCount / trips) * 100 : 0, // Use filtered trips
    });
  }

  return metrics.sort((a, b) => a.agentName.localeCompare(b.agentName));
};

// Build time series data efficiently
export const buildTimeSeriesOptimized = (
  tripsByDate: Map<string, Map<string, number>>,
  quotesByDate: Map<string, Map<string, number>>,
  passthroughsByDate: Map<string, Map<string, number>>,
  hotPassByDate: Map<string, Map<string, number>>,
  bookingsByDate: Map<string, Map<string, number>>,
  seniors: string[]
): TimeSeriesData => {
  // Collect all agents and dates
  const allAgents = new Set<string>();
  const allDates = new Set<string>();

  const allMaps = [tripsByDate, quotesByDate, passthroughsByDate, hotPassByDate, bookingsByDate];
  for (const map of allMaps) {
    for (const [agent, dates] of map) {
      allAgents.add(agent);
      for (const date of dates.keys()) {
        if (date !== 'unknown') allDates.add(date);
      }
    }
  }

  const sortedDates = Array.from(allDates).sort();
  const seniorSet = new Set(seniors.map(s => s.toLowerCase()));

  // Build agent time series
  const agentTimeSeries: AgentTimeSeries[] = [];

  for (const agent of allAgents) {
    const tripDates = tripsByDate.get(agent) || new Map();
    const quoteDates = quotesByDate.get(agent) || new Map();
    const passthroughDates = passthroughsByDate.get(agent) || new Map();
    const hotPassDates = hotPassByDate.get(agent) || new Map();
    const bookingDates = bookingsByDate.get(agent) || new Map();

    const dailyMetrics: DailyAgentMetrics[] = sortedDates.map(date => ({
      date,
      trips: tripDates.get(date) || 0,
      quotes: quoteDates.get(date) || 0,
      passthroughs: passthroughDates.get(date) || 0,
      hotPasses: hotPassDates.get(date) || 0,
      bookings: bookingDates.get(date) || 0,
      nonConverted: 0, // Non-converted doesn't have date breakdown
    }));

    agentTimeSeries.push({ agentName: agent, dailyMetrics });
  }

  // Calculate group averages
  const calcGroupDaily = (agents: AgentTimeSeries[]) => {
    return sortedDates.map(date => {
      let totalTrips = 0, totalQuotes = 0, totalPassthroughs = 0;
      let totalHotPasses = 0, totalBookings = 0;

      for (const agent of agents) {
        const dayMetrics = agent.dailyMetrics.find(m => m.date === date);
        if (dayMetrics) {
          totalTrips += dayMetrics.trips;
          totalQuotes += dayMetrics.quotes;
          totalPassthroughs += dayMetrics.passthroughs;
          totalHotPasses += dayMetrics.hotPasses;
          totalBookings += dayMetrics.bookings;
        }
      }

      return {
        date,
        tq: totalTrips > 0 ? (totalQuotes / totalTrips) * 100 : 0,
        tp: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
        pq: totalPassthroughs > 0 ? (totalQuotes / totalPassthroughs) * 100 : 0,
        hp: totalPassthroughs > 0 ? (totalHotPasses / totalPassthroughs) * 100 : 0,
        bk: totalTrips > 0 ? (totalBookings / totalTrips) * 100 : 0,
        nc: 0,
      };
    });
  };

  const seniorAgents = agentTimeSeries.filter(a => seniorSet.has(a.agentName.toLowerCase()));
  const nonSeniorAgents = agentTimeSeries.filter(a => !seniorSet.has(a.agentName.toLowerCase()));

  return {
    dateRange: {
      start: sortedDates[0] || '',
      end: sortedDates[sortedDates.length - 1] || '',
    },
    agents: agentTimeSeries.sort((a, b) => a.agentName.localeCompare(b.agentName)),
    departmentDaily: calcGroupDaily(agentTimeSeries),
    seniorDaily: calcGroupDaily(seniorAgents),
    nonSeniorDaily: calcGroupDaily(nonSeniorAgents),
  };
};
