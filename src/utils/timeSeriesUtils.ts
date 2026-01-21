import type { TimeSeriesData, MetricKey, PercentMetricKey, CountMetricKey } from '../types';

// Percentage metrics (shown on left Y-axis)
export const PERCENT_METRICS: PercentMetricKey[] = ['tq', 'tp', 'pq', 'hp', 'nc'];
// Count metrics (shown on right Y-axis)
export const COUNT_METRICS: CountMetricKey[] = ['trips', 'quotes', 'passthroughs', 'bookings'];

export const isPercentMetric = (metric: MetricKey): metric is PercentMetricKey =>
  PERCENT_METRICS.includes(metric as PercentMetricKey);

export const isCountMetric = (metric: MetricKey): metric is CountMetricKey =>
  COUNT_METRICS.includes(metric as CountMetricKey);

// Merge time series data into format suitable for Recharts
// Returns array like: [{ date: '2024-01-01', Agent1_tq: 50, Agent2_tq: 60, dept_tq: 55, ... }]
export const mergeSeriesForChart = (
  timeSeriesData: TimeSeriesData,
  selectedAgents: string[],
  selectedMetrics: MetricKey[],
  showDeptAvg: boolean,
  showSeniorAvg: boolean,
  showNonSeniorAvg: boolean,
  dateStartIdx: number,
  dateEndIdx: number
): Record<string, unknown>[] => {
  // Get all unique dates
  const allDates = new Set<string>();
  timeSeriesData.agents.forEach((agent) => {
    agent.dailyMetrics.forEach((m) => {
      if (m.date !== 'unknown') allDates.add(m.date);
    });
  });
  const sortedDates = Array.from(allDates).sort();

  // Apply date range filter
  const filteredDates = sortedDates.slice(dateStartIdx, dateEndIdx + 1);

  // PERF: Pre-build lookup maps for O(1) access instead of O(n) .find() calls
  // Build agent name -> agent map
  const agentMap = new Map(timeSeriesData.agents.map((a) => [a.agentName, a]));

  // Build date -> metrics map for each agent (only for selected agents)
  const agentDateMaps = new Map<string, Map<string, typeof timeSeriesData.agents[0]['dailyMetrics'][0]>>();
  for (const agentName of selectedAgents) {
    const agent = agentMap.get(agentName);
    if (agent) {
      agentDateMaps.set(agentName, new Map(agent.dailyMetrics.map((m) => [m.date, m])));
    }
  }

  // Build date -> daily ratio maps for averages
  const deptDayMap = new Map(timeSeriesData.departmentDaily.map((d) => [d.date, d]));
  const seniorDayMap = new Map(timeSeriesData.seniorDaily.map((d) => [d.date, d]));
  const nonSeniorDayMap = new Map(timeSeriesData.nonSeniorDaily.map((d) => [d.date, d]));

  // Build data points - now all lookups are O(1)
  return filteredDates.map((date) => {
    const point: Record<string, unknown> = { date };

    // Add selected agent metrics
    for (const agentName of selectedAgents) {
      const agentDates = agentDateMaps.get(agentName);
      if (!agentDates) continue;

      const dayMetrics = agentDates.get(date); // O(1) instead of O(d)

      // Calculate all metric values
      const values: Record<MetricKey, number> = dayMetrics
        ? {
            // Percentage metrics
            tq: dayMetrics.trips > 0 ? (dayMetrics.quotes / dayMetrics.trips) * 100 : 0,
            tp: dayMetrics.trips > 0 ? (dayMetrics.passthroughs / dayMetrics.trips) * 100 : 0,
            pq: dayMetrics.passthroughs > 0 ? (dayMetrics.quotes / dayMetrics.passthroughs) * 100 : 0,
            hp: dayMetrics.passthroughs > 0 ? (dayMetrics.hotPasses / dayMetrics.passthroughs) * 100 : 0,
            nc: dayMetrics.trips > 0 ? (dayMetrics.nonConverted / dayMetrics.trips) * 100 : 0,
            // Raw count metrics
            trips: dayMetrics.trips,
            quotes: dayMetrics.quotes,
            passthroughs: dayMetrics.passthroughs,
            bookings: dayMetrics.bookings,
          }
        : { tq: 0, tp: 0, pq: 0, hp: 0, nc: 0, trips: 0, quotes: 0, passthroughs: 0, bookings: 0 };

      for (const metric of selectedMetrics) {
        point[`${agentName}_${metric}`] = values[metric];
      }
    }

    // Add average lines - O(1) lookups instead of O(d)
    const deptDay = deptDayMap.get(date);
    const seniorDay = seniorDayMap.get(date);
    const nonSeniorDay = nonSeniorDayMap.get(date);

    for (const metric of selectedMetrics) {
      if (showDeptAvg && deptDay) {
        point[`dept_${metric}`] = deptDay[metric as keyof typeof deptDay];
      }
      if (showSeniorAvg && seniorDay) {
        point[`senior_${metric}`] = seniorDay[metric as keyof typeof seniorDay];
      }
      if (showNonSeniorAvg && nonSeniorDay) {
        point[`nonsenior_${metric}`] = nonSeniorDay[metric as keyof typeof nonSeniorDay];
      }
    }

    return point;
  });
};

// Generate consistent colors for agents
const AGENT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#A855F7', // purple
];

export const getAgentColor = (index: number): string => {
  return AGENT_COLORS[index % AGENT_COLORS.length];
};

// Get all unique dates from time series data
export const getAllDates = (timeSeriesData: TimeSeriesData): string[] => {
  const allDates = new Set<string>();
  timeSeriesData.agents.forEach((agent) => {
    agent.dailyMetrics.forEach((m) => {
      if (m.date !== 'unknown') allDates.add(m.date);
    });
  });
  return Array.from(allDates).sort();
};
