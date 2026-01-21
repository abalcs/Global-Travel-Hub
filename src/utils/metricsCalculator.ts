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
  nonConvertedCounts: Map<string, number>
): Metrics[] => {
  // Get all unique agents
  const allAgents = new Set<string>();
  [tripsCounts, quotesCounts, passthroughsCounts, bookingsCounts, nonConvertedCounts].forEach(m => {
    m.forEach((_, agent) => allAgents.add(agent));
  });

  // PERF: Pre-build normalized lookup map for case-insensitive matching - O(m) once instead of O(n*m)
  const normalizedNonConverted = new Map<string, number>();
  for (const [key, value] of nonConvertedCounts.entries()) {
    normalizedNonConverted.set(key.toLowerCase().trim(), value);
  }

  const metrics: Metrics[] = [];

  for (const agentName of allAgents) {
    const trips = tripsCounts.get(agentName) || 0;
    const quotes = quotesCounts.get(agentName) || 0;
    const passthroughs = passthroughsCounts.get(agentName) || 0;
    const hotPasses = hotPassCounts.get(agentName) || 0;
    const bookings = bookingsCounts.get(agentName) || 0;

    // PERF: O(1) lookup instead of O(m) iteration for case-insensitive match
    let nonConvertedCount = nonConvertedCounts.get(agentName) || 0;
    if (nonConvertedCount === 0) {
      nonConvertedCount = normalizedNonConverted.get(agentName.toLowerCase().trim()) || 0;
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

  // Build agent time series
  const agentTimeSeries: AgentTimeSeries[] = [];

  for (const agent of allAgents) {
    const tripDates = tripsByDate.get(agent) || new Map();
    const quoteDates = quotesByDate.get(agent) || new Map();
    const passthroughDates = passthroughsByDate.get(agent) || new Map();
    const hotPassDates = hotPassByDate.get(agent) || new Map();
    const bookingDates = bookingsByDate.get(agent) || new Map();
    const nonConvertedDates = nonConvertedByDate?.get(agent) || new Map();

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
