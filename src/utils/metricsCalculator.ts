import type { Metrics } from '../types';
import type { CSVRow } from './csvParser';
import type { AgentTimeSeries, DailyAgentMetrics, TimeSeriesData } from '../types';
import { formatDateString } from './dateParser';
import { findColumn } from './columnDetection';

// Optimized single-pass counting with date support
export interface CountResult {
  total: Map<string, number>;
  byDate: Map<string, Map<string, number>>;
}

// Re-export parseDate for backwards compatibility, using centralized utility
const parseDate = (value: string): string | null => formatDateString(value);

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

// Find date column - delegates to centralized utility
export const findDateColumn = (row: CSVRow, patterns: string[]): string | null => findColumn(row, patterns);

// Parse date string to comparable integer (YYYYMMDD format) to avoid timezone issues
const dateToInt = (dateStr: string): number => {
  // dateStr is in YYYY-MM-DD format
  return parseInt(dateStr.replace(/-/g, ''), 10);
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

  // Convert filter dates to integers for comparison (avoids timezone issues)
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const agent = row[agentColumn];
    if (!agent) continue;

    // Parse date
    let dateStr: string | null = null;
    if (dateColumn && row[dateColumn]) {
      dateStr = parseDate(row[dateColumn]);
    }

    // Apply date filter if active
    if (hasDateFilter) {
      // If date filter is active but row has no valid date, skip the row
      if (!dateStr) continue;

      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
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

// Count repeat client trips and passthroughs by agent
export const countRepeatByAgent = (
  tripsRows: CSVRow[],
  agentColumn: string,
  dateColumn: string | null,
  startDate: string,
  endDate: string
): { repeatTrips: Map<string, number>; repeatPassthroughs: Map<string, number> } => {
  const repeatTrips = new Map<string, number>();
  const repeatPassthroughs = new Map<string, number>();

  if (tripsRows.length === 0) return { repeatTrips, repeatPassthroughs };

  // Find repeat and passthrough columns
  const keys = Object.keys(tripsRows[0]);
  const repeatCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('repeat') || lower.includes('client type') || lower.includes('customer type');
  });
  const passthroughDateCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('passthrough to sales date') || lower.includes('passthrough date');
  });

  if (!repeatCol) return { repeatTrips, repeatPassthroughs };

  // Convert filter dates to integers for comparison
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  for (const row of tripsRows) {
    const agent = row[agentColumn];
    if (!agent) continue;

    // Check if repeat client
    const repeatValue = (row[repeatCol] || '').toString().toLowerCase().trim();
    const isRepeat = repeatValue === 'repeat' || repeatValue === 'returning' || repeatValue === 'existing';
    if (!isRepeat) continue;

    // Parse date
    let dateStr: string | null = null;
    if (dateColumn && row[dateColumn]) {
      dateStr = parseDate(row[dateColumn]);
    }

    // Apply date filter if active
    if (hasDateFilter) {
      if (!dateStr) continue;
      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
    }

    // Count repeat trip
    repeatTrips.set(agent, (repeatTrips.get(agent) || 0) + 1);

    // Check for passthrough
    if (passthroughDateCol) {
      const passthroughValue = row[passthroughDateCol];
      if (passthroughValue && passthroughValue.toString().trim() !== '') {
        repeatPassthroughs.set(agent, (repeatPassthroughs.get(agent) || 0) + 1);
      }
    }
  }

  return { repeatTrips, repeatPassthroughs };
};

// Count quotes started by agent (each row = 1 quote started)
export const countQuotesStartedByAgent = (
  quotesStartedRows: CSVRow[],
  startDate: string,
  endDate: string
): Map<string, number> => {
  const quotesStarted = new Map<string, number>();

  if (quotesStartedRows.length === 0) return quotesStarted;

  // Find agent and date columns
  const keys = Object.keys(quotesStartedRows[0]);
  const agentCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('gtt owner') ||
           lower.includes('owner name') ||
           lower.includes('agent') ||
           lower.includes('last gtt action by') ||
           lower === '_agent';
  });

  const dateCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('date') || lower.includes('created');
  });

  if (!agentCol) return quotesStarted;

  // Convert filter dates to integers for comparison
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  for (const row of quotesStartedRows) {
    const agent = row[agentCol];
    if (!agent) continue;

    // Parse date if available
    let dateStr: string | null = null;
    if (dateCol && row[dateCol]) {
      dateStr = parseDate(row[dateCol]);
    }

    // Apply date filter if active
    if (hasDateFilter) {
      if (!dateStr) continue;
      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
    }

    // Count quote started (each row = 1 quote started)
    quotesStarted.set(agent, (quotesStarted.get(agent) || 0) + 1);
  }

  return quotesStarted;
};

// Count B2B trips and passthroughs by agent
export const countB2bByAgent = (
  tripsRows: CSVRow[],
  agentColumn: string,
  dateColumn: string | null,
  startDate: string,
  endDate: string
): { b2bTrips: Map<string, number>; b2bPassthroughs: Map<string, number> } => {
  const b2bTrips = new Map<string, number>();
  const b2bPassthroughs = new Map<string, number>();

  if (tripsRows.length === 0) return { b2bTrips, b2bPassthroughs };

  // Find B2B and passthrough columns
  const keys = Object.keys(tripsRows[0]);
  const b2bCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('b2b') || lower.includes('lead channel') || lower.includes('business type') || lower.includes('client category');
  });
  const passthroughDateCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('passthrough to sales date') || lower.includes('passthrough date');
  });

  if (!b2bCol) return { b2bTrips, b2bPassthroughs };

  // Convert filter dates to integers for comparison
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  for (const row of tripsRows) {
    const agent = row[agentColumn];
    if (!agent) continue;

    // Check if B2B
    const b2bValue = (row[b2bCol] || '').toString().toLowerCase().trim();
    const isB2b = b2bValue === 'b2b' || b2bValue.includes('b2b') || b2bValue === 'business';
    if (!isB2b) continue;

    // Parse date
    let dateStr: string | null = null;
    if (dateColumn && row[dateColumn]) {
      dateStr = parseDate(row[dateColumn]);
    }

    // Apply date filter if active
    if (hasDateFilter) {
      if (!dateStr) continue;
      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
    }

    // Count B2B trip
    b2bTrips.set(agent, (b2bTrips.get(agent) || 0) + 1);

    // Check for passthrough
    if (passthroughDateCol) {
      const passthroughValue = row[passthroughDateCol];
      if (passthroughValue && passthroughValue.toString().trim() !== '') {
        b2bPassthroughs.set(agent, (b2bPassthroughs.get(agent) || 0) + 1);
      }
    }
  }

  return { b2bTrips, b2bPassthroughs };
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
// Returns both total counts and by-date breakdown
export const countNonConvertedOptimized = (
  rows: CSVRow[],
  dateColumn: string | null,
  startDate: string,
  endDate: string,
  tripDateMap?: Map<string, string>
): Map<string, number> => {
  const result = countNonConvertedWithDates(rows, dateColumn, startDate, endDate, tripDateMap);
  return result.total;
};

// Extended version that also returns by-date breakdown
export const countNonConvertedWithDates = (
  rows: CSVRow[],
  dateColumn: string | null,
  startDate: string,
  endDate: string,
  tripDateMap?: Map<string, string>
): CountResult => {
  const total = new Map<string, number>();
  const byDate = new Map<string, Map<string, number>>();

  if (rows.length === 0) return { total, byDate };

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

  if (!leadOwnerCol || !nonValidatedCol) return { total, byDate };

  // Use integer comparison to avoid timezone issues
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  let currentAgent = '';

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

    // Try to find a date for this row
    let dateStr: string | null = null;

    // First try: direct date column
    if (dateColumn && row[dateColumn]) {
      dateStr = parseDate(row[dateColumn]);
    }

    // Second try: match trip name to trip dates
    if (!dateStr && tripNameCol && tripDateMap && tripDateMap.size > 0) {
      const tripName = (row[tripNameCol] || '').trim().toLowerCase();
      if (tripName) {
        dateStr = tripDateMap.get(tripName) || null;
      }
    }

    // Apply date filter if active
    if (hasDateFilter) {
      if (dateStr) {
        const rowInt = dateToInt(dateStr);
        if (startInt && rowInt < startInt) continue;
        if (endInt && rowInt > endInt) continue;
      } else {
        // No date found - can't filter this row, so skip it when date filter is active
        continue;
      }
    }

    // Count total
    total.set(currentAgent, (total.get(currentAgent) || 0) + 1);

    // Count by date (only if we have a date)
    if (dateStr) {
      if (!byDate.has(currentAgent)) {
        byDate.set(currentAgent, new Map());
      }
      const agentDates = byDate.get(currentAgent)!;
      agentDates.set(dateStr, (agentDates.get(dateStr) || 0) + 1);
    }
  }

  return { total, byDate };
};

// Calculate all metrics in a single pass
export const calculateMetrics = (
  tripsCounts: Map<string, number>,
  quotesCounts: Map<string, number>,
  passthroughsCounts: Map<string, number>,
  hotPassCounts: Map<string, number>,
  bookingsCounts: Map<string, number>,
  nonConvertedCounts: Map<string, number>,
  repeatTripsCounts?: Map<string, number>,
  repeatPassthroughsCounts?: Map<string, number>,
  b2bTripsCounts?: Map<string, number>,
  b2bPassthroughsCounts?: Map<string, number>,
  quotesStartedCounts?: Map<string, number>
): Metrics[] => {
  // Get all unique agents - include hotPassCounts to capture all agents
  const allAgents = new Set<string>();
  [tripsCounts, quotesCounts, passthroughsCounts, hotPassCounts, bookingsCounts, nonConvertedCounts].forEach(m => {
    m.forEach((_, agent) => allAgents.add(agent));
  });

  // PERF: Pre-build normalized lookup maps for case-insensitive matching - O(m) once instead of O(n*m)
  const normalizedNonConverted = new Map<string, number>();
  for (const [key, value] of nonConvertedCounts.entries()) {
    normalizedNonConverted.set(key.toLowerCase().trim(), value);
  }

  const normalizedHotPass = new Map<string, number>();
  for (const [key, value] of hotPassCounts.entries()) {
    normalizedHotPass.set(key.toLowerCase().trim(), value);
  }

  const metrics: Metrics[] = [];

  for (const agentName of allAgents) {
    const trips = tripsCounts.get(agentName) || 0;
    const quotes = quotesCounts.get(agentName) || 0;
    const passthroughs = passthroughsCounts.get(agentName) || 0;
    const bookings = bookingsCounts.get(agentName) || 0;

    // Case-insensitive match for hot passes
    let hotPasses = hotPassCounts.get(agentName) || 0;
    if (hotPasses === 0) {
      hotPasses = normalizedHotPass.get(agentName.toLowerCase().trim()) || 0;
    }

    // Case-insensitive match for non-converted
    let nonConvertedCount = nonConvertedCounts.get(agentName) || 0;
    if (nonConvertedCount === 0) {
      nonConvertedCount = normalizedNonConverted.get(agentName.toLowerCase().trim()) || 0;
    }

    // Get repeat client data
    const repeatTrips = repeatTripsCounts?.get(agentName) || 0;
    const repeatPassthroughs = repeatPassthroughsCounts?.get(agentName) || 0;

    // Get B2B data
    const b2bTrips = b2bTripsCounts?.get(agentName) || 0;
    const b2bPassthroughs = b2bPassthroughsCounts?.get(agentName) || 0;

    // Get quotes started data (with case-insensitive fallback)
    let quotesStarted = quotesStartedCounts?.get(agentName) || 0;
    if (quotesStarted === 0 && quotesStartedCounts) {
      // Try case-insensitive match
      for (const [key, value] of quotesStartedCounts.entries()) {
        if (key.toLowerCase().trim() === agentName.toLowerCase().trim()) {
          quotesStarted = value;
          break;
        }
      }
    }

    // Calculate potential T>Q: (quotes + quotesStarted) / trips * 100
    // This shows what the T>Q rate could be if all started quotes were sent
    const potentialTQ = trips > 0 ? ((quotes + quotesStarted) / trips) * 100 : 0;

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
      repeatTrips,
      repeatPassthroughs,
      repeatTpRate: repeatTrips > 0 ? (repeatPassthroughs / repeatTrips) * 100 : 0,
      b2bTrips,
      b2bPassthroughs,
      b2bTpRate: b2bTrips > 0 ? (b2bPassthroughs / b2bTrips) * 100 : 0,
      quotesStarted,
      potentialTQ,
    });
  }

  return metrics.sort((a, b) => a.agentName.localeCompare(b.agentName));
};

// Helper to find agent data with case-insensitive matching
const findAgentData = <T>(
  map: Map<string, T>,
  agentName: string,
  normalizedMap: Map<string, T>,
  defaultValue: T
): T => {
  // Try exact match first
  const exact = map.get(agentName);
  if (exact !== undefined) return exact;

  // Try case-insensitive match
  const normalized = normalizedMap.get(agentName.toLowerCase().trim());
  if (normalized !== undefined) return normalized;

  return defaultValue;
};

// Build normalized lookup map for case-insensitive agent matching
const buildNormalizedMap = <T>(map: Map<string, T>): Map<string, T> => {
  const normalized = new Map<string, T>();
  for (const [key, value] of map.entries()) {
    normalized.set(key.toLowerCase().trim(), value);
  }
  return normalized;
};

// Build time series data efficiently
export const buildTimeSeriesOptimized = (
  tripsByDate: Map<string, Map<string, number>>,
  quotesByDate: Map<string, Map<string, number>>,
  passthroughsByDate: Map<string, Map<string, number>>,
  hotPassByDate: Map<string, Map<string, number>>,
  bookingsByDate: Map<string, Map<string, number>>,
  seniors: string[],
  nonConvertedByDate?: Map<string, Map<string, number>>
): TimeSeriesData => {
  // Collect all agents and dates
  const allAgents = new Set<string>();
  const allDates = new Set<string>();

  const allMaps = [tripsByDate, quotesByDate, passthroughsByDate, hotPassByDate, bookingsByDate];
  if (nonConvertedByDate) allMaps.push(nonConvertedByDate);

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

  // Build normalized lookup maps for case-insensitive agent matching
  const normalizedTrips = buildNormalizedMap(tripsByDate);
  const normalizedQuotes = buildNormalizedMap(quotesByDate);
  const normalizedPassthroughs = buildNormalizedMap(passthroughsByDate);
  const normalizedHotPass = buildNormalizedMap(hotPassByDate);
  const normalizedBookings = buildNormalizedMap(bookingsByDate);
  const normalizedNonConverted = nonConvertedByDate ? buildNormalizedMap(nonConvertedByDate) : new Map();

  const emptyDateMap = new Map<string, number>();

  // Build agent time series
  const agentTimeSeries: AgentTimeSeries[] = [];

  for (const agent of allAgents) {
    const tripDates = findAgentData(tripsByDate, agent, normalizedTrips, emptyDateMap);
    const quoteDates = findAgentData(quotesByDate, agent, normalizedQuotes, emptyDateMap);
    const passthroughDates = findAgentData(passthroughsByDate, agent, normalizedPassthroughs, emptyDateMap);
    const hotPassDates = findAgentData(hotPassByDate, agent, normalizedHotPass, emptyDateMap);
    const bookingDates = findAgentData(bookingsByDate, agent, normalizedBookings, emptyDateMap);
    const nonConvertedDates = nonConvertedByDate
      ? findAgentData(nonConvertedByDate, agent, normalizedNonConverted, emptyDateMap)
      : emptyDateMap;

    const dailyMetrics: DailyAgentMetrics[] = sortedDates.map(date => ({
      date,
      trips: tripDates.get(date) || 0,
      quotes: quoteDates.get(date) || 0,
      passthroughs: passthroughDates.get(date) || 0,
      hotPasses: hotPassDates.get(date) || 0,
      bookings: bookingDates.get(date) || 0,
      nonConverted: nonConvertedDates.get(date) || 0,
    }));

    agentTimeSeries.push({ agentName: agent, dailyMetrics });
  }

  // Calculate group averages
  // PERF: Pre-build date index maps for O(1) lookup instead of O(d) .find() per agent per date
  const calcGroupDaily = (agents: AgentTimeSeries[]) => {
    // Build date->metrics map for each agent once - O(a*d) total
    const agentDateMaps = agents.map(agent =>
      new Map(agent.dailyMetrics.map(m => [m.date, m]))
    );

    return sortedDates.map(date => {
      let totalTrips = 0, totalQuotes = 0, totalPassthroughs = 0;
      let totalHotPasses = 0, totalBookings = 0, totalNonConverted = 0;

      for (let i = 0; i < agents.length; i++) {
        const dayMetrics = agentDateMaps[i].get(date); // O(1) instead of O(d)
        if (dayMetrics) {
          totalTrips += dayMetrics.trips;
          totalQuotes += dayMetrics.quotes;
          totalPassthroughs += dayMetrics.passthroughs;
          totalHotPasses += dayMetrics.hotPasses;
          totalBookings += dayMetrics.bookings;
          totalNonConverted += dayMetrics.nonConverted;
        }
      }

      return {
        date,
        // Percentage metrics
        tq: totalTrips > 0 ? (totalQuotes / totalTrips) * 100 : 0,
        tp: totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0,
        pq: totalPassthroughs > 0 ? (totalQuotes / totalPassthroughs) * 100 : 0,
        hp: totalPassthroughs > 0 ? (totalHotPasses / totalPassthroughs) * 100 : 0,
        nc: totalTrips > 0 ? (totalNonConverted / totalTrips) * 100 : 0,
        // Raw count metrics
        trips: totalTrips,
        quotes: totalQuotes,
        passthroughs: totalPassthroughs,
        bookings: totalBookings,
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

// Calculate daily averages for a specific segment (repeat clients or B2B)
export const calculateSegmentDailyAverages = (
  tripsRows: CSVRow[],
  segmentType: 'repeat' | 'b2b',
  startDate: string,
  endDate: string
): import('../types').DailyRatioPoint[] => {
  if (tripsRows.length === 0) return [];

  // Find relevant columns
  const segmentCol = segmentType === 'repeat'
    ? findColumn(tripsRows[0], ['repeat/new', 'repeat', 'client type', 'customer type'])
    : findColumn(tripsRows[0], ['b2b/b2c', 'b2b', 'business type', 'client category', 'lead channel']);

  const dateCol = findColumn(tripsRows[0], ['created date', 'trip: created date', 'date']);
  const passthroughDateCol = findColumn(tripsRows[0], ['passthrough to sales date', 'passthrough date']);

  if (!segmentCol || !dateCol) return [];

  // Convert filter dates to integers for comparison (avoids timezone issues)
  const startDateInt = startDate ? parseInt(startDate.replace(/-/g, ''), 10) : 0;
  const endDateInt = endDate ? parseInt(endDate.replace(/-/g, ''), 10) : 99999999;

  // Track daily stats for the segment
  const dailyStats: Map<string, { trips: number; passthroughs: number }> = new Map();

  for (const row of tripsRows) {
    const segmentValue = (row[segmentCol] || '').toString().toLowerCase().trim();

    // Determine if this row matches the segment
    let matchesSegment = false;
    if (segmentType === 'repeat') {
      matchesSegment = segmentValue === 'repeat' || segmentValue === 'returning' || segmentValue === 'existing';
    } else {
      matchesSegment = segmentValue === 'b2b' || segmentValue.includes('b2b') || segmentValue === 'business';
    }

    if (!matchesSegment) continue;

    // Parse date
    const dateStr = row[dateCol];
    const parsedDate = parseDate(dateStr?.toString() || '');
    if (!parsedDate) continue;

    // Apply date range filter
    const parsedDateInt = parseInt(parsedDate.replace(/-/g, ''), 10);
    if (parsedDateInt < startDateInt || parsedDateInt > endDateInt) continue;

    // Check for passthrough
    const passthroughValue = passthroughDateCol ? row[passthroughDateCol] : null;
    const hasPassthrough = passthroughValue && passthroughValue.toString().trim() !== '';

    // Aggregate by date
    if (!dailyStats.has(parsedDate)) {
      dailyStats.set(parsedDate, { trips: 0, passthroughs: 0 });
    }
    const stats = dailyStats.get(parsedDate)!;
    stats.trips++;
    if (hasPassthrough) stats.passthroughs++;
  }

  // Convert to DailyRatioPoint array
  const sortedDates = Array.from(dailyStats.keys()).sort();
  return sortedDates.map(date => {
    const stats = dailyStats.get(date)!;
    return {
      date,
      tq: 0, // We don't have quotes data here
      tp: stats.trips > 0 ? (stats.passthroughs / stats.trips) * 100 : 0,
      pq: 0,
      hp: 0,
      nc: 0,
      trips: stats.trips,
      quotes: 0,
      passthroughs: stats.passthroughs,
      bookings: 0,
    };
  });
};
