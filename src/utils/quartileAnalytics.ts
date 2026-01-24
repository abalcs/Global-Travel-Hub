import type { TimeSeriesData, QuartileAgent, QuartileDailyPoint, QuartileAnalysisData } from '../types';

/**
 * Filter agents by minimum passthrough volume over the date range
 */
function filterAgentsByVolume(
  timeSeriesData: TimeSeriesData,
  allDates: string[],
  dateStartIdx: number,
  dateEndIdx: number,
  minPassthroughs: number
): Map<string, { totalTrips: number; totalPassthroughs: number; totalQuotes: number; totalHotPasses: number; totalBookings: number }> {
  const agentTotals = new Map<string, { totalTrips: number; totalPassthroughs: number; totalQuotes: number; totalHotPasses: number; totalBookings: number }>();
  const filteredDates = new Set(allDates.slice(dateStartIdx, dateEndIdx + 1));

  for (const agent of timeSeriesData.agents) {
    let totalTrips = 0;
    let totalPassthroughs = 0;
    let totalQuotes = 0;
    let totalHotPasses = 0;
    let totalBookings = 0;

    for (const day of agent.dailyMetrics) {
      if (filteredDates.has(day.date)) {
        totalTrips += day.trips;
        totalPassthroughs += day.passthroughs;
        totalQuotes += day.quotes;
        totalHotPasses += day.hotPasses;
        totalBookings += day.bookings;
      }
    }

    if (totalPassthroughs >= minPassthroughs) {
      agentTotals.set(agent.agentName, { totalTrips, totalPassthroughs, totalQuotes, totalHotPasses, totalBookings });
    }
  }

  return agentTotals;
}

/**
 * Sort agents by hot pass rate and split into top/bottom quartiles
 */
function splitIntoQuartiles(
  agentTotals: Map<string, { totalTrips: number; totalPassthroughs: number; totalQuotes: number; totalHotPasses: number; totalBookings: number }>
): { topQuartile: QuartileAgent[]; bottomQuartile: QuartileAgent[] } {
  // Convert to array with calculated hot pass rates
  const agents: QuartileAgent[] = Array.from(agentTotals.entries()).map(([name, totals]) => ({
    agentName: name,
    aggregateHotPassRate: totals.totalPassthroughs > 0
      ? (totals.totalHotPasses / totals.totalPassthroughs) * 100
      : 0,
    totalTrips: totals.totalTrips,
    totalPassthroughs: totals.totalPassthroughs,
    totalQuotes: totals.totalQuotes,
    totalHotPasses: totals.totalHotPasses,
    totalBookings: totals.totalBookings,
  }));

  // Sort by hot pass rate descending (highest first)
  agents.sort((a, b) => b.aggregateHotPassRate - a.aggregateHotPassRate);

  // Calculate quartile size (at least 1 agent per quartile if we have enough agents)
  const quartileSize = Math.max(1, Math.floor(agents.length / 4));

  // Top quartile = highest hot pass rates
  const topQuartile = agents.slice(0, quartileSize);
  // Bottom quartile = lowest hot pass rates
  const bottomQuartile = agents.slice(-quartileSize);

  return { topQuartile, bottomQuartile };
}

/**
 * Calculate daily T>Q averages for each quartile group
 */
function calculateDailyTQAverages(
  timeSeriesData: TimeSeriesData,
  allDates: string[],
  dateStartIdx: number,
  dateEndIdx: number,
  topQuartileNames: Set<string>,
  bottomQuartileNames: Set<string>
): QuartileDailyPoint[] {
  const filteredDates = allDates.slice(dateStartIdx, dateEndIdx + 1);

  // Build agent -> date -> metrics map for O(1) lookup
  const agentDateMap = new Map<string, Map<string, { trips: number; quotes: number }>>();
  for (const agent of timeSeriesData.agents) {
    const dateMap = new Map<string, { trips: number; quotes: number }>();
    for (const day of agent.dailyMetrics) {
      dateMap.set(day.date, { trips: day.trips, quotes: day.quotes });
    }
    agentDateMap.set(agent.agentName, dateMap);
  }

  return filteredDates.map((date) => {
    let topTotalTrips = 0;
    let topTotalQuotes = 0;
    let topCount = 0;
    let bottomTotalTrips = 0;
    let bottomTotalQuotes = 0;
    let bottomCount = 0;

    // Aggregate metrics for top quartile agents on this date
    for (const agentName of topQuartileNames) {
      const dateMap = agentDateMap.get(agentName);
      const metrics = dateMap?.get(date);
      if (metrics && metrics.trips > 0) {
        topTotalTrips += metrics.trips;
        topTotalQuotes += metrics.quotes;
        topCount++;
      }
    }

    // Aggregate metrics for bottom quartile agents on this date
    for (const agentName of bottomQuartileNames) {
      const dateMap = agentDateMap.get(agentName);
      const metrics = dateMap?.get(date);
      if (metrics && metrics.trips > 0) {
        bottomTotalTrips += metrics.trips;
        bottomTotalQuotes += metrics.quotes;
        bottomCount++;
      }
    }

    // Calculate T>Q % for each group (weighted average)
    const topQuartileAvgTQ = topTotalTrips > 0
      ? (topTotalQuotes / topTotalTrips) * 100
      : 0;
    const bottomQuartileAvgTQ = bottomTotalTrips > 0
      ? (bottomTotalQuotes / bottomTotalTrips) * 100
      : 0;

    return {
      date,
      topQuartileAvgTQ,
      bottomQuartileAvgTQ,
      topQuartileAgentCount: topCount,
      bottomQuartileAgentCount: bottomCount,
    };
  });
}

/**
 * Main function to calculate quartile analysis
 */
export function calculateQuartileAnalysis(
  timeSeriesData: TimeSeriesData,
  allDates: string[],
  dateStartIdx: number,
  dateEndIdx: number,
  minPassthroughs: number = 10
): QuartileAnalysisData | null {
  // Filter agents by minimum volume
  const agentTotals = filterAgentsByVolume(
    timeSeriesData,
    allDates,
    dateStartIdx,
    dateEndIdx,
    minPassthroughs
  );

  // Need at least 4 agents to form quartiles
  if (agentTotals.size < 4) {
    return null;
  }

  // Split into quartiles
  const { topQuartile, bottomQuartile } = splitIntoQuartiles(agentTotals);

  // Calculate daily T>Q averages
  const topQuartileNames = new Set(topQuartile.map((a) => a.agentName));
  const bottomQuartileNames = new Set(bottomQuartile.map((a) => a.agentName));

  const dailyComparison = calculateDailyTQAverages(
    timeSeriesData,
    allDates,
    dateStartIdx,
    dateEndIdx,
    topQuartileNames,
    bottomQuartileNames
  );

  return {
    topQuartileAgents: topQuartile,
    bottomQuartileAgents: bottomQuartile,
    dailyComparison,
    dateRange: {
      start: allDates[dateStartIdx] || '',
      end: allDates[dateEndIdx] || '',
    },
  };
}
