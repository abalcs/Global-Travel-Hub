import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesData, ChartConfig, MetricKey } from '../types';
import { mergeSeriesForChart, getAgentColor, getAllDates, isPercentMetric, isCountMetric, PERCENT_METRICS, COUNT_METRICS } from '../utils/timeSeriesUtils';
import { loadChartConfig, saveChartConfig } from '../utils/storage';
import { calculateSeriesRegression, type RegressionResult } from '../utils/regression';
import { decimateChartData } from '../utils/decimation';
import { QuartileAnalysisSection } from './QuartileAnalysisSection';

interface TrendsViewProps {
  timeSeriesData: TimeSeriesData;
  seniors: string[];
}

const METRIC_LABELS: Record<MetricKey, string> = {
  // Percentage metrics
  tq: 'T>Q %',
  tp: 'T>P %',
  pq: 'P>Q %',
  hp: 'Hot Pass %',
  nc: '% Non-Conv',
  // Raw count metrics
  trips: 'Trips',
  quotes: 'Quotes',
  passthroughs: 'Passthroughs',
  bookings: 'Bookings',
};

const ALL_PERCENT_METRICS: MetricKey[] = [...PERCENT_METRICS];
const ALL_COUNT_METRICS: MetricKey[] = [...COUNT_METRICS];

// Performance constants
const MAX_DATA_POINTS = 80; // Decimate data if more points than this
const MAX_SERIES_WARNING = 30; // Warn if more than this many series

export const TrendsView: React.FC<TrendsViewProps> = ({ timeSeriesData, seniors }) => {
  const allDates = useMemo(() => getAllDates(timeSeriesData), [timeSeriesData]);
  const allAgents = useMemo(
    () => timeSeriesData.agents.map((a) => a.agentName).sort(),
    [timeSeriesData]
  );

  // PERF: Memoize agent-to-index mapping for O(1) color lookups
  const agentIndexMap = useMemo(
    () => new Map(allAgents.map((agent, index) => [agent, index])),
    [allAgents]
  );

  // Helper to get agent color in O(1)
  const getAgentColorFast = useCallback(
    (agent: string) => getAgentColor(agentIndexMap.get(agent) ?? 0),
    [agentIndexMap]
  );

  // Build agent -> dates map for efficient date range lookups
  // Only count dates where agent had actual activity (trips > 0)
  const agentDateRanges = useMemo(() => {
    const ranges = new Map<string, { minIdx: number; maxIdx: number }>();
    // Pre-build date index map for O(1) lookups
    const dateIndexMap = new Map(allDates.map((d, i) => [d, i]));

    timeSeriesData.agents.forEach((agent) => {
      // Only include dates where the agent had actual activity
      const agentDates = agent.dailyMetrics
        .filter((m) => m.date !== 'unknown' && m.trips > 0)
        .map((m) => m.date)
        .sort();

      if (agentDates.length > 0) {
        const minDate = agentDates[0];
        const maxDate = agentDates[agentDates.length - 1];
        const minIdx = dateIndexMap.get(minDate);
        const maxIdx = dateIndexMap.get(maxDate);

        if (minIdx !== undefined && maxIdx !== undefined) {
          ranges.set(agent.agentName, { minIdx, maxIdx });
        }
      }
    });

    return ranges;
  }, [timeSeriesData, allDates]);

  // Valid metrics for filtering stale configs
  const VALID_METRICS: MetricKey[] = [...ALL_PERCENT_METRICS, ...ALL_COUNT_METRICS];

  // Load saved config or use defaults - always start with no agents selected
  const [config, setConfig] = useState<ChartConfig>(() => {
    const saved = loadChartConfig();
    if (saved) {
      // Validate saved metrics are still valid (filter out old 'bk' metric etc.)
      const validMetrics = saved.selectedMetrics.filter((m) => VALID_METRICS.includes(m));
      return {
        ...saved,
        selectedMetrics: validMetrics.length > 0 ? validMetrics : ['tq'],
        dateRangeEnd: Math.min(saved.dateRangeEnd, allDates.length - 1),
      };
    }
    return {
      selectedAgents: [],
      selectedMetrics: ['tq'],
      showDeptAvg: true,
      showSeniorAvg: false,
      showNonSeniorAvg: false,
      showRepeatClient: false,
      showB2b: false,
      dateRangeStart: 0,
      dateRangeEnd: allDates.length - 1,
    };
  });

  // Regression state - default to 10% which is more realistic for noisy daily data
  const [showTrendLines, setShowTrendLines] = useState(false);
  const [rSquaredThreshold, setRSquaredThreshold] = useState(0.10);
  const [hideRawData, setHideRawData] = useState(false);
  const [outlierHandling, setOutlierHandling] = useState<'none' | 'percentile'>('percentile');
  const [showLegend, setShowLegend] = useState(true);

  // UI state for collapsible sections
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // PERF: Debounced date range for slider - updates immediately for UI, debounced for chart
  const [debouncedDateRange, setDebouncedDateRange] = useState({
    start: config.dateRangeStart,
    end: config.dateRangeEnd,
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update debounced date range with delay
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedDateRange({
        start: config.dateRangeStart,
        end: config.dateRangeEnd,
      });
    }, 150); // 150ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [config.dateRangeStart, config.dateRangeEnd]);

  // Save config when it changes
  useEffect(() => {
    saveChartConfig(config);
  }, [config]);

  // Calculate total series count for performance warning
  const totalSeriesCount = useMemo(() => {
    let count = config.selectedAgents.length * config.selectedMetrics.length;
    if (config.showDeptAvg) count += config.selectedMetrics.length;
    if (config.showSeniorAvg) count += config.selectedMetrics.length;
    if (config.showNonSeniorAvg) count += config.selectedMetrics.length;
    if (config.showRepeatClient) count += config.selectedMetrics.length;
    if (config.showB2b) count += config.selectedMetrics.length;
    return count;
  }, [config.selectedAgents.length, config.selectedMetrics.length, config.showDeptAvg, config.showSeniorAvg, config.showNonSeniorAvg, config.showRepeatClient, config.showB2b]);

  const showPerformanceWarning = totalSeriesCount > MAX_SERIES_WARNING;

  // Calculate the date range for the currently selected agents
  const selectedAgentsDateRange = useMemo(() => {
    if (config.selectedAgents.length === 0) {
      return { minIdx: 0, maxIdx: allDates.length - 1 };
    }

    let minIdx = allDates.length - 1;
    let maxIdx = 0;

    for (const agentName of config.selectedAgents) {
      const range = agentDateRanges.get(agentName);
      if (range) {
        minIdx = Math.min(minIdx, range.minIdx);
        maxIdx = Math.max(maxIdx, range.maxIdx);
      }
    }

    // Ensure valid range
    if (minIdx > maxIdx) {
      return { minIdx: 0, maxIdx: allDates.length - 1 };
    }

    return { minIdx, maxIdx };
  }, [config.selectedAgents, agentDateRanges, allDates.length]);

  // Fit date range to selected agents
  const fitDateRangeToSelection = useCallback(() => {
    if (config.selectedAgents.length === 0) return;

    setConfig((prev) => ({
      ...prev,
      dateRangeStart: selectedAgentsDateRange.minIdx,
      dateRangeEnd: selectedAgentsDateRange.maxIdx,
    }));
  }, [config.selectedAgents.length, selectedAgentsDateRange]);

  // Prepare chart data with decimation for performance
  const { chartData, isDecimated, originalPointCount } = useMemo(() => {
    const rawData = mergeSeriesForChart(
      timeSeriesData,
      config.selectedAgents,
      config.selectedMetrics,
      config.showDeptAvg,
      config.showSeniorAvg,
      config.showNonSeniorAvg,
      debouncedDateRange.start,
      debouncedDateRange.end,
      config.showRepeatClient || false,
      config.showB2b || false
    );

    const originalCount = rawData.length;

    // Apply LTTB decimation if too many data points
    if (rawData.length > MAX_DATA_POINTS) {
      const decimated = decimateChartData(
        rawData as { date: string; [key: string]: unknown }[],
        MAX_DATA_POINTS
      );
      return {
        chartData: decimated,
        isDecimated: true,
        originalPointCount: originalCount,
      };
    }

    return { chartData: rawData, isDecimated: false, originalPointCount: originalCount };
  }, [timeSeriesData, config.selectedAgents, config.selectedMetrics, config.showDeptAvg, config.showSeniorAvg, config.showNonSeniorAvg, config.showRepeatClient, config.showB2b, debouncedDateRange]);

  // Calculate regressions for all visible series
  const regressions = useMemo(() => {
    if (!showTrendLines || chartData.length < 3) return new Map<string, RegressionResult>();

    const results = new Map<string, RegressionResult>();

    // Calculate for agent series
    for (const agent of config.selectedAgents) {
      for (const metric of config.selectedMetrics) {
        const key = `${agent}_${metric}`;
        const regression = calculateSeriesRegression(chartData, key, rSquaredThreshold);
        if (regression) {
          results.set(key, regression);
        }
      }
    }

    // Calculate for average lines
    if (config.showDeptAvg) {
      for (const metric of config.selectedMetrics) {
        const key = `dept_${metric}`;
        const regression = calculateSeriesRegression(chartData, key, rSquaredThreshold);
        if (regression) {
          results.set(key, regression);
        }
      }
    }

    if (config.showSeniorAvg) {
      for (const metric of config.selectedMetrics) {
        const key = `senior_${metric}`;
        const regression = calculateSeriesRegression(chartData, key, rSquaredThreshold);
        if (regression) {
          results.set(key, regression);
        }
      }
    }

    if (config.showNonSeniorAvg) {
      for (const metric of config.selectedMetrics) {
        const key = `nonsenior_${metric}`;
        const regression = calculateSeriesRegression(chartData, key, rSquaredThreshold);
        if (regression) {
          results.set(key, regression);
        }
      }
    }

    if (config.showRepeatClient) {
      for (const metric of config.selectedMetrics) {
        const key = `repeat_${metric}`;
        const regression = calculateSeriesRegression(chartData, key, rSquaredThreshold);
        if (regression) {
          results.set(key, regression);
        }
      }
    }

    if (config.showB2b) {
      for (const metric of config.selectedMetrics) {
        const key = `b2b_${metric}`;
        const regression = calculateSeriesRegression(chartData, key, rSquaredThreshold);
        if (regression) {
          results.set(key, regression);
        }
      }
    }

    return results;
  }, [chartData, config, showTrendLines, rSquaredThreshold]);

  // Merge trend line data into chart data
  const chartDataWithTrends = useMemo(() => {
    if (!showTrendLines || regressions.size === 0) return chartData;

    return chartData.map((point, index) => {
      const newPoint = { ...point };
      regressions.forEach((regression, key) => {
        newPoint[`${key}_trend`] = regression.predictedValues[index];
      });
      return newPoint;
    });
  }, [chartData, regressions, showTrendLines]);

  // Helper to calculate domain for a set of values with outlier handling
  const calculateDomain = useCallback((allValues: number[], applyOutlierHandling: boolean): { domain: [number, number]; hasOutliers: boolean; actualMax?: number } => {
    if (allValues.length === 0) {
      return { domain: [0, 100], hasOutliers: false };
    }

    const sortedValues = [...allValues].sort((a, b) => a - b);
    const actualMin = sortedValues[0];
    const actualMax = sortedValues[sortedValues.length - 1];

    if (!applyOutlierHandling || outlierHandling === 'none') {
      const padding = (actualMax - actualMin) * 0.05 || 5;
      return {
        domain: [Math.max(0, Math.floor(actualMin - padding)), Math.ceil(actualMax + padding)],
        hasOutliers: false
      };
    }

    // Percentile-based: use 5th and 95th percentile
    const p5Index = Math.floor(sortedValues.length * 0.05);
    const p95Index = Math.floor(sortedValues.length * 0.95);
    const p5 = sortedValues[p5Index];
    const p95 = sortedValues[p95Index];

    // Calculate IQR-based bounds for outlier detection
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q3Index = Math.floor(sortedValues.length * 0.75);
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    const upperFence = q3 + 1.5 * iqr;

    const hasOutliers = actualMax > upperFence;

    if (hasOutliers) {
      const padding = (p95 - p5) * 0.1 || 5;
      return {
        domain: [Math.max(0, Math.floor(p5 - padding)), Math.ceil(p95 + padding)],
        hasOutliers: true,
        actualMax: actualMax
      };
    }

    const padding = (actualMax - actualMin) * 0.05 || 5;
    return {
      domain: [Math.max(0, Math.floor(actualMin - padding)), Math.ceil(actualMax + padding)],
      hasOutliers: false
    };
  }, [outlierHandling]);

  // Separate selected metrics by type
  const { selectedPercentMetrics, selectedCountMetrics } = useMemo(() => {
    return {
      selectedPercentMetrics: config.selectedMetrics.filter(isPercentMetric),
      selectedCountMetrics: config.selectedMetrics.filter(isCountMetric),
    };
  }, [config.selectedMetrics]);

  // PERF: Pre-build data keys to avoid repeated string concatenation
  const dataKeys = useMemo(() => {
    const percentKeys: string[] = [];
    const countKeys: string[] = [];

    // Agent keys
    for (const agent of config.selectedAgents) {
      for (const metric of selectedPercentMetrics) {
        percentKeys.push(`${agent}_${metric}`);
      }
      for (const metric of selectedCountMetrics) {
        countKeys.push(`${agent}_${metric}`);
      }
    }

    // Average keys
    const avgSources: string[] = [];
    if (config.showDeptAvg) avgSources.push('dept');
    if (config.showSeniorAvg) avgSources.push('senior');
    if (config.showNonSeniorAvg) avgSources.push('nonsenior');
    if (config.showRepeatClient) avgSources.push('repeat');
    if (config.showB2b) avgSources.push('b2b');

    for (const source of avgSources) {
      for (const metric of selectedPercentMetrics) {
        percentKeys.push(`${source}_${metric}`);
      }
      for (const metric of selectedCountMetrics) {
        countKeys.push(`${source}_${metric}`);
      }
    }

    return { percentKeys, countKeys };
  }, [config.selectedAgents, config.showDeptAvg, config.showSeniorAvg, config.showNonSeniorAvg, config.showRepeatClient, config.showB2b, selectedPercentMetrics, selectedCountMetrics]);

  // Calculate Y-axis domains for both metric types - optimized with pre-built keys
  const yAxisConfig = useMemo(() => {
    if (chartDataWithTrends.length === 0) {
      return {
        percentDomain: [0, 100] as [number, number],
        countDomain: [0, 100] as [number, number],
        hasPercentOutliers: false,
        hasCountOutliers: false,
      };
    }

    // Collect values by metric type
    const percentValues: number[] = [];
    const countValues: number[] = [];

    // Single pass through data with pre-built keys
    for (const point of chartDataWithTrends) {
      for (const key of dataKeys.percentKeys) {
        const value = point[key] as number | undefined;
        if (typeof value === 'number' && !isNaN(value)) {
          percentValues.push(value);
        }
      }
      for (const key of dataKeys.countKeys) {
        const value = point[key] as number | undefined;
        if (typeof value === 'number' && !isNaN(value)) {
          countValues.push(value);
        }
      }
    }

    const percentResult = calculateDomain(percentValues, true);
    const countResult = calculateDomain(countValues, true);

    return {
      percentDomain: percentResult.domain,
      countDomain: countResult.domain,
      hasPercentOutliers: percentResult.hasOutliers,
      hasCountOutliers: countResult.hasOutliers,
      percentActualMax: percentResult.actualMax,
      countActualMax: countResult.actualMax,
    };
  }, [chartDataWithTrends, dataKeys, calculateDomain]);

  // Toggle agent selection
  const toggleAgent = useCallback((agentName: string) => {
    setConfig((prev) => {
      const isSelected = prev.selectedAgents.includes(agentName);
      const newAgents = isSelected
        ? prev.selectedAgents.filter((a) => a !== agentName)
        : [...prev.selectedAgents, agentName];
      return { ...prev, selectedAgents: newAgents };
    });
  }, []);

  // Toggle metric
  const toggleMetric = useCallback((metric: MetricKey) => {
    setConfig((prev) => {
      const isSelected = prev.selectedMetrics.includes(metric);
      if (isSelected && prev.selectedMetrics.length === 1) {
        return prev; // Keep at least one metric selected
      }
      const newMetrics = isSelected
        ? prev.selectedMetrics.filter((m) => m !== metric)
        : [...prev.selectedMetrics, metric];
      return { ...prev, selectedMetrics: newMetrics };
    });
  }, []);

  // Toggle average lines
  const toggleAvg = useCallback((type: 'dept' | 'senior' | 'nonsenior' | 'repeat' | 'b2b') => {
    setConfig((prev) => {
      switch (type) {
        case 'dept':
          return { ...prev, showDeptAvg: !prev.showDeptAvg };
        case 'senior':
          return { ...prev, showSeniorAvg: !prev.showSeniorAvg };
        case 'nonsenior':
          return { ...prev, showNonSeniorAvg: !prev.showNonSeniorAvg };
        case 'repeat':
          return { ...prev, showRepeatClient: !prev.showRepeatClient };
        case 'b2b':
          return { ...prev, showB2b: !prev.showB2b };
        default:
          return prev;
      }
    });
  }, []);

  // Update date range
  const updateDateRange = useCallback(
    (start: number, end: number) => {
      setConfig((prev) => ({
        ...prev,
        dateRangeStart: Math.max(0, start),
        dateRangeEnd: Math.min(allDates.length - 1, end),
      }));
    },
    [allDates.length]
  );

  // Format date for display (short - for x-axis)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format date for tooltip (includes year for clarity)
  const formatDateWithYear = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Select/deselect all agents
  const selectAllAgents = useCallback(() => {
    setConfig((prev) => ({ ...prev, selectedAgents: [...allAgents] }));
  }, [allAgents]);

  const deselectAllAgents = useCallback(() => {
    setConfig((prev) => ({ ...prev, selectedAgents: [] }));
  }, []);

  // Check if an agent is a senior
  const isSenior = useCallback(
    (agentName: string) =>
      seniors.some((s) => s.toLowerCase() === agentName.toLowerCase()),
    [seniors]
  );

  if (allDates.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
        <h2 className="text-xl font-semibold text-white mb-4">Trends</h2>
        <p className="text-slate-400">No time-series data available. Upload files with date information to view trends.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50 space-y-6">
      <h2 className="text-xl font-semibold text-white">Trends Over Time</h2>

      {/* Controls Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Agent Selection - 3 cols */}
        <div className="lg:col-span-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">Agents</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{config.selectedAgents.length} selected</span>
              <button
                onClick={selectAllAgents}
                className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer active:scale-95 transition-transform"
              >
                All
              </button>
              <button
                onClick={deselectAllAgents}
                className="text-xs text-slate-400 hover:text-slate-300 cursor-pointer active:scale-95 transition-transform"
              >
                None
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto bg-slate-900/50 rounded-lg p-2 space-y-0.5">
            {allAgents.map((agent, index) => (
              <label
                key={agent}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-700/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={config.selectedAgents.includes(agent)}
                  onChange={() => toggleAgent(agent)}
                  className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getAgentColor(index) }}
                />
                <span className="text-sm text-slate-300 truncate">
                  {agent}
                  {isSenior(agent) && (
                    <span className="ml-1 text-xs text-amber-400">(Sr)</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Metrics & Options - 6 cols */}
        <div className="lg:col-span-6 space-y-3">
          {/* Metrics Row */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Rate Metrics</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {ALL_PERCENT_METRICS.map((metric) => (
                  <button
                    key={metric}
                    onClick={() => toggleMetric(metric)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                      config.selectedMetrics.includes(metric)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700/70 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {METRIC_LABELS[metric]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Volume Metrics</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {ALL_COUNT_METRICS.map((metric) => (
                  <button
                    key={metric}
                    onClick={() => toggleMetric(metric)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                      config.selectedMetrics.includes(metric)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700/70 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {METRIC_LABELS[metric]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison Lines Row */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Compare Against</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <button
                onClick={() => toggleAvg('dept')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  config.showDeptAvg
                    ? 'bg-gray-600 text-white'
                    : 'bg-slate-700/70 text-slate-400 hover:bg-slate-600'
                }`}
              >
                Dept Avg
              </button>
              <button
                onClick={() => toggleAvg('senior')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  config.showSeniorAvg
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-700/70 text-slate-400 hover:bg-slate-600'
                }`}
              >
                Senior Avg
              </button>
              <button
                onClick={() => toggleAvg('nonsenior')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  config.showNonSeniorAvg
                    ? 'bg-slate-500 text-white'
                    : 'bg-slate-700/70 text-slate-400 hover:bg-slate-600'
                }`}
              >
                Non-Senior Avg
              </button>
              <button
                onClick={() => setShowTrendLines(!showTrendLines)}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  showTrendLines
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700/70 text-slate-400 hover:bg-slate-600'
                }`}
              >
                Trend Lines {showTrendLines && regressions.size > 0 && `(${regressions.size})`}
              </button>
            </div>
          </div>

          {/* Lead Channel Section */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Lead Channel</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <button
                onClick={() => toggleAvg('repeat')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  config.showRepeatClient
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700/70 text-slate-400 hover:bg-slate-600'
                }`}
                title={timeSeriesData.repeatClientDaily ? undefined : 'Re-upload data to enable this feature'}
              >
                Repeat
              </button>
              <button
                onClick={() => toggleAvg('b2b')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  config.showB2b
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-700/70 text-slate-400 hover:bg-slate-600'
                }`}
                title={timeSeriesData.b2bDaily ? undefined : 'Re-upload data to enable this feature'}
              >
                B2B
              </button>
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <div>
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-all cursor-pointer active:scale-95"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
            </button>

            <div
                className={`grid transition-all duration-300 ease-in-out ${
                  showAdvancedOptions ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="p-3 bg-slate-900/50 rounded-lg space-y-3">
                    {/* Trend Line Options */}
                    {showTrendLines && (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">R² threshold:</span>
                          <input
                            type="range"
                            min={0}
                            max={0.99}
                            step={0.01}
                            value={rSquaredThreshold}
                            onChange={(e) => setRSquaredThreshold(parseFloat(e.target.value))}
                            className="w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                          <span className="text-xs text-emerald-400 font-mono">
                            {(rSquaredThreshold * 100).toFixed(0)}%
                          </span>
                        </div>
                        <button
                          onClick={() => setHideRawData(!hideRawData)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                            hideRawData
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {hideRawData ? 'Show Raw' : 'Hide Raw'}
                        </button>
                      </div>
                    )}

                    {/* Y-Axis Scaling */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-400">Y-Axis:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setOutlierHandling('percentile')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                            outlierHandling === 'percentile'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          Smart
                        </button>
                        <button
                          onClick={() => setOutlierHandling('none')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                            outlierHandling === 'none'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          Full
                        </button>
                      </div>
                      {(yAxisConfig.hasPercentOutliers || yAxisConfig.hasCountOutliers) && outlierHandling === 'percentile' && (
                        <span className="text-xs text-amber-400">Outliers trimmed</span>
                      )}
                    </div>

                    {/* Display Options */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-400">Display:</span>
                      <button
                        onClick={() => setShowLegend(!showLegend)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                          showLegend
                            ? 'bg-slate-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        Legend
                      </button>
                      <button
                        onClick={() => {
                          setConfig({
                            selectedAgents: [],
                            selectedMetrics: ['tq'],
                            showDeptAvg: true,
                            showSeniorAvg: false,
                            showNonSeniorAvg: false,
                            dateRangeStart: 0,
                            dateRangeEnd: allDates.length - 1,
                          });
                          setShowTrendLines(false);
                          setOutlierHandling('percentile');
                        }}
                        className="px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer active:scale-95 bg-slate-700 text-slate-400 hover:bg-red-600 hover:text-white"
                      >
                        Reset All
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {/* Date Range - 3 cols */}
        <div className="lg:col-span-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">Date Range</label>
            {config.selectedAgents.length > 0 && (
              <button
                onClick={fitDateRangeToSelection}
                className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer active:scale-95 transition-transform"
                title="Fit date range to selected agents"
              >
                Fit to Selection
              </button>
            )}
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white font-medium">{allDates[config.dateRangeStart] || ''}</span>
              <span className="text-slate-500">→</span>
              <span className="text-white font-medium">{allDates[config.dateRangeEnd] || ''}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-8">From</span>
                <input
                  type="range"
                  min={0}
                  max={allDates.length - 1}
                  value={config.dateRangeStart}
                  onChange={(e) =>
                    updateDateRange(
                      parseInt(e.target.value),
                      Math.max(parseInt(e.target.value), config.dateRangeEnd)
                    )
                  }
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-8">To</span>
                <input
                  type="range"
                  min={0}
                  max={allDates.length - 1}
                  value={config.dateRangeEnd}
                  onChange={(e) =>
                    updateDateRange(
                      Math.min(config.dateRangeStart, parseInt(e.target.value)),
                      parseInt(e.target.value)
                    )
                  }
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
            <div className="text-xs text-slate-500 text-center">
              {config.dateRangeEnd - config.dateRangeStart + 1} days selected
            </div>
          </div>
        </div>
      </div>

      {/* Performance indicators */}
      {(showPerformanceWarning || isDecimated) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {showPerformanceWarning && (
            <span className="px-2 py-1 bg-amber-900/50 text-amber-300 rounded">
              {totalSeriesCount} series selected - consider reducing for better performance
            </span>
          )}
          {isDecimated && (
            <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded">
              Showing {chartData.length} of {originalPointCount} data points (optimized)
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="bg-slate-900/50 rounded-xl p-4">
        {chartDataWithTrends.length === 0 || (config.selectedAgents.length === 0 && !config.showDeptAvg && !config.showSeniorAvg && !config.showNonSeniorAvg && !config.showRepeatClient && !config.showB2b) ? (
          <div className="h-96 flex items-center justify-center text-slate-400">
            Select at least one agent or comparison line to view trends
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={chartDataWithTrends} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#64748b"
                fontSize={12}
                tickMargin={10}
              />
              {/* Left Y-axis for percentage metrics */}
              <YAxis
                yAxisId="percent"
                orientation="left"
                domain={yAxisConfig.percentDomain}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                stroke="#818cf8"
                fontSize={12}
                allowDataOverflow={outlierHandling === 'percentile'}
                hide={selectedPercentMetrics.length === 0}
              />
              {/* Right Y-axis for count metrics */}
              <YAxis
                yAxisId="count"
                orientation="right"
                domain={yAxisConfig.countDomain}
                tickFormatter={(v) => Math.round(v).toLocaleString()}
                stroke="#34d399"
                fontSize={12}
                allowDataOverflow={outlierHandling === 'percentile'}
                hide={selectedCountMetrics.length === 0}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '12px',
                }}
                labelStyle={{ color: '#f1f5f9', fontWeight: 'bold', marginBottom: '8px' }}
                itemStyle={{ padding: '2px 0' }}
                isAnimationActive={false}
                formatter={(value: number | undefined, name?: string) => {
                  if (!name) return [`${(value ?? 0).toFixed(1)}%`, undefined];

                  // Extract metric and source from name (e.g., "Agent Name_quotes" -> metric="quotes", source="Agent Name")
                  const parts = name.split('_');
                  const metric = parts[parts.length - 1] as MetricKey;
                  const source = parts.slice(0, -1).join(' ');
                  const isPercent = isPercentMetric(metric);
                  const metricLabel = METRIC_LABELS[metric] || metric;

                  // Format the source name
                  let displaySource = source;
                  if (source === 'dept') displaySource = 'Department';
                  else if (source === 'senior') displaySource = 'Senior Avg';
                  else if (source === 'nonsenior') displaySource = 'Non-Senior Avg';
                  else if (source === 'repeat') displaySource = 'Repeat Clients';
                  else if (source === 'b2b') displaySource = 'B2B Lead';

                  // Format the value
                  const formattedValue = isPercent
                    ? `${(value ?? 0).toFixed(1)}%`
                    : Math.round(value ?? 0).toLocaleString();

                  // Return formatted label with source and metric
                  return [formattedValue, `${displaySource} - ${metricLabel}`];
                }}
                labelFormatter={(label) => formatDateWithYear(label as string)}
              />
              {showLegend && (
                <Legend
                  wrapperStyle={{
                    paddingTop: '10px',
                    maxHeight: '80px',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                  }}
                  formatter={(value: string) => {
                    // Clean up legend names - show metric type more clearly
                    const parts = value.split('_');
                    if (parts.length >= 2) {
                      const metric = parts[parts.length - 1];
                      const name = parts.slice(0, -1).join('_');
                      const metricLabel = METRIC_LABELS[metric as keyof typeof METRIC_LABELS] || metric;
                      if (name === 'dept') return `Dept (${metricLabel})`;
                      if (name === 'senior') return `Sr (${metricLabel})`;
                      if (name === 'nonsenior') return `Non-Sr (${metricLabel})`;
                      if (name === 'repeat') return `Repeat (${metricLabel})`;
                      if (name === 'b2b') return `B2B (${metricLabel})`;
                      // For agents, just show first name + metric abbreviation
                      const shortName = name.split(' ')[0];
                      return `${shortName} (${metricLabel})`;
                    }
                    return value;
                  }}
                />
              )}

              {/* Agent lines */}
              {!hideRawData && config.selectedAgents.map((agent) =>
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`${agent}_${metric}`}
                    type="monotone"
                    dataKey={`${agent}_${metric}`}
                    name={`${agent}_${metric}`}
                    yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                    stroke={getAgentColorFast(agent)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                    strokeDasharray={
                      metric === 'tq' ? undefined :
                      metric === 'tp' ? '5 5' :
                      metric === 'pq' ? '2 2' :
                      metric === 'hp' ? '8 2' :
                      metric === 'nc' ? '1 3' :
                      // Count metrics - solid lines with different widths
                      metric === 'trips' ? undefined :
                      metric === 'quotes' ? '6 3' :
                      metric === 'passthroughs' ? '4 2' :
                      '3 3' // bookings
                    }
                  />
                ))
              )}

              {/* Average lines */}
              {!hideRawData && config.showDeptAvg &&
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`dept_${metric}`}
                    type="monotone"
                    dataKey={`dept_${metric}`}
                    name={`dept_${metric}`}
                    yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                    stroke="#6B7280"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}

              {!hideRawData && config.showSeniorAvg &&
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`senior_${metric}`}
                    type="monotone"
                    dataKey={`senior_${metric}`}
                    name={`senior_${metric}`}
                    yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                    stroke="#F59E0B"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}

              {!hideRawData && config.showNonSeniorAvg &&
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`nonsenior_${metric}`}
                    type="monotone"
                    dataKey={`nonsenior_${metric}`}
                    name={`nonsenior_${metric}`}
                    yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                    stroke="#94A3B8"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}

              {!hideRawData && config.showRepeatClient &&
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`repeat_${metric}`}
                    type="monotone"
                    dataKey={`repeat_${metric}`}
                    name={`repeat_${metric}`}
                    yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                    stroke="#9333EA"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}

              {!hideRawData && config.showB2b &&
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`b2b_${metric}`}
                    type="monotone"
                    dataKey={`b2b_${metric}`}
                    name={`b2b_${metric}`}
                    yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                    stroke="#14B8A6"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}

              {/* Trend lines */}
              {showTrendLines &&
                config.selectedAgents.map((agent) =>
                  config.selectedMetrics.map((metric) => {
                    const key = `${agent}_${metric}`;
                    const regression = regressions.get(key);
                    if (!regression) return null;
                    return (
                      <Line
                        key={`${key}_trend`}
                        type="linear"
                        dataKey={`${key}_trend`}
                        name={`${key}_trend`}
                        yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                        stroke={getAgentColorFast(agent)}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        strokeOpacity={0.7}
                        dot={false}
                        connectNulls
                        legendType="none"
                        isAnimationActive={false}
                      />
                    );
                  })
                )}

              {/* Trend lines for averages */}
              {showTrendLines && config.showDeptAvg &&
                config.selectedMetrics.map((metric) => {
                  const key = `dept_${metric}`;
                  const regression = regressions.get(key);
                  if (!regression) return null;
                  return (
                    <Line
                      key={`${key}_trend`}
                      type="linear"
                      dataKey={`${key}_trend`}
                      name={`${key}_trend`}
                      yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                      stroke="#6B7280"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      strokeOpacity={0.7}
                      dot={false}
                      connectNulls
                      legendType="none"
                      isAnimationActive={false}
                    />
                  );
                })}

              {showTrendLines && config.showSeniorAvg &&
                config.selectedMetrics.map((metric) => {
                  const key = `senior_${metric}`;
                  const regression = regressions.get(key);
                  if (!regression) return null;
                  return (
                    <Line
                      key={`${key}_trend`}
                      type="linear"
                      dataKey={`${key}_trend`}
                      name={`${key}_trend`}
                      yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      strokeOpacity={0.7}
                      dot={false}
                      connectNulls
                      legendType="none"
                      isAnimationActive={false}
                    />
                  );
                })}

              {showTrendLines && config.showNonSeniorAvg &&
                config.selectedMetrics.map((metric) => {
                  const key = `nonsenior_${metric}`;
                  const regression = regressions.get(key);
                  if (!regression) return null;
                  return (
                    <Line
                      key={`${key}_trend`}
                      type="linear"
                      dataKey={`${key}_trend`}
                      name={`${key}_trend`}
                      yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                      stroke="#94A3B8"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      strokeOpacity={0.7}
                      dot={false}
                      connectNulls
                      legendType="none"
                      isAnimationActive={false}
                    />
                  );
                })}

              {showTrendLines && config.showRepeatClient &&
                config.selectedMetrics.map((metric) => {
                  const key = `repeat_${metric}`;
                  const regression = regressions.get(key);
                  if (!regression) return null;
                  return (
                    <Line
                      key={`${key}_trend`}
                      type="linear"
                      dataKey={`${key}_trend`}
                      name={`${key}_trend`}
                      yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                      stroke="#9333EA"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      strokeOpacity={0.7}
                      dot={false}
                      connectNulls
                      legendType="none"
                      isAnimationActive={false}
                    />
                  );
                })}

              {showTrendLines && config.showB2b &&
                config.selectedMetrics.map((metric) => {
                  const key = `b2b_${metric}`;
                  const regression = regressions.get(key);
                  if (!regression) return null;
                  return (
                    <Line
                      key={`${key}_trend`}
                      type="linear"
                      dataKey={`${key}_trend`}
                      name={`${key}_trend`}
                      yAxisId={isPercentMetric(metric) ? 'percent' : 'count'}
                      stroke="#14B8A6"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      strokeOpacity={0.7}
                      dot={false}
                      connectNulls
                      legendType="none"
                      isAnimationActive={false}
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* R² Statistics Panel */}
      {showTrendLines && (
        <div className="bg-slate-900/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">
            Regression Analysis (R² ≥ {(rSquaredThreshold * 100).toFixed(0)}%)
            {regressions.size > 0 && (
              <span className="ml-2 text-emerald-400">— {regressions.size} trend line{regressions.size !== 1 ? 's' : ''} shown</span>
            )}
          </h3>
          {regressions.size > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from(regressions.entries()).map(([key, regression]) => {
                const parts = key.split('_');
                const metric = parts[parts.length - 1];
                const name = parts.slice(0, -1).join('_');
                const displayName = name === 'dept' ? 'Department'
                  : name === 'senior' ? 'Senior Avg'
                  : name === 'nonsenior' ? 'Non-Senior Avg'
                  : name === 'repeat' ? 'Repeat Clients'
                  : name === 'b2b' ? 'B2B Lead'
                  : name;

                // Calculate trend direction as % change over the period
                const firstPredicted = regression.predictedValues[0];
                const lastPredicted = regression.predictedValues[regression.predictedValues.length - 1];
                const percentChange = firstPredicted > 0
                  ? ((lastPredicted - firstPredicted) / firstPredicted) * 100
                  : 0;

                return (
                  <div
                    key={key}
                    className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50"
                  >
                    <div className="text-xs text-slate-400 truncate">
                      {displayName} ({METRIC_LABELS[metric as MetricKey]})
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-emerald-400">
                        R²: {(regression.rSquared * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs text-slate-500">
                        {regression.type === 'log-linear' ? 'exp' : 'linear'}
                      </span>
                    </div>
                    <div className="text-xs mt-1">
                      <span className={percentChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {percentChange >= 0 ? '↗' : '↘'} {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}% over period
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {regression.validPointCount} data points
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">
              No series meet the R² threshold of {(rSquaredThreshold * 100).toFixed(0)}%.
              Try lowering the threshold slider to see more trend lines.
            </p>
          )}
        </div>
      )}

      {/* Legend explanation */}
      <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="text-indigo-400">Rate (L):</span> T&gt;Q, T&gt;P, P&gt;Q, Hot Pass %, % Non-Conv</span>
        <span><span className="text-emerald-400">Volume (R):</span> Trips, Quotes, Passthroughs, Bookings</span>
        <span><span className="text-slate-400">Lines:</span> solid=tq/trips, dashed=other metrics</span>
      </div>

      {/* Quartile Analysis Section */}
      <QuartileAnalysisSection
        timeSeriesData={timeSeriesData}
        dateStartIdx={debouncedDateRange.start}
        dateEndIdx={debouncedDateRange.end}
        allDates={allDates}
      />
    </div>
  );
};
