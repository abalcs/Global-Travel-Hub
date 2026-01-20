import type { TimeSeriesData, MetricKey } from '../types';

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

  // Build data points
  return filteredDates.map((date) => {
    const point: Record<string, unknown> = { date };

    // Add selected agent metrics
    for (const agentName of selectedAgents) {
      const agent = timeSeriesData.agents.find((a) => a.agentName === agentName);
      if (!agent) continue;

      const dayMetrics = agent.dailyMetrics.find((m) => m.date === date);
      const ratios = dayMetrics
        ? {
            tq: dayMetrics.trips > 0 ? (dayMetrics.quotes / dayMetrics.trips) * 100 : 0,
            tp: dayMetrics.trips > 0 ? (dayMetrics.passthroughs / dayMetrics.trips) * 100 : 0,
            pq: dayMetrics.passthroughs > 0 ? (dayMetrics.quotes / dayMetrics.passthroughs) * 100 : 0,
            hp: dayMetrics.passthroughs > 0 ? (dayMetrics.hotPasses / dayMetrics.passthroughs) * 100 : 0,
            bk: dayMetrics.trips > 0 ? (dayMetrics.bookings / dayMetrics.trips) * 100 : 0,
            nc: dayMetrics.trips > 0 ? (dayMetrics.nonConverted / dayMetrics.trips) * 100 : 0,
          }
        : { tq: 0, tp: 0, pq: 0, hp: 0, bk: 0, nc: 0 };

      for (const metric of selectedMetrics) {
        point[`${agentName}_${metric}`] = ratios[metric];
      }
    }

    // Add average lines
    const deptDay = timeSeriesData.departmentDaily.find((d) => d.date === date);
    const seniorDay = timeSeriesData.seniorDaily.find((d) => d.date === date);
    const nonSeniorDay = timeSeriesData.nonSeniorDaily.find((d) => d.date === date);

    for (const metric of selectedMetrics) {
      if (showDeptAvg && deptDay) {
        point[`dept_${metric}`] = deptDay[metric];
      }
      if (showSeniorAvg && seniorDay) {
        point[`senior_${metric}`] = seniorDay[metric];
      }
      if (showNonSeniorAvg && nonSeniorDay) {
        point[`nonsenior_${metric}`] = nonSeniorDay[metric];
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
