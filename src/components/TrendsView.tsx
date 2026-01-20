import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { mergeSeriesForChart, getAgentColor, getAllDates } from '../utils/timeSeriesUtils';
import { loadChartConfig, saveChartConfig } from '../utils/storage';
import { calculateSeriesRegression, type RegressionResult } from '../utils/regression';

interface TrendsViewProps {
  timeSeriesData: TimeSeriesData;
  seniors: string[];
}

const METRIC_LABELS: Record<MetricKey, string> = {
  tq: 'T>Q',
  tp: 'T>P',
  pq: 'P>Q',
  hp: 'Hot Pass',
  bk: 'Bookings',
  nc: '% Non-Conv',
};

const ALL_METRICS: MetricKey[] = ['tq', 'tp', 'pq', 'hp', 'bk', 'nc'];

export const TrendsView: React.FC<TrendsViewProps> = ({ timeSeriesData, seniors }) => {
  const allDates = useMemo(() => getAllDates(timeSeriesData), [timeSeriesData]);
  const allAgents = useMemo(
    () => timeSeriesData.agents.map((a) => a.agentName).sort(),
    [timeSeriesData]
  );

  // Load saved config or use defaults
  const [config, setConfig] = useState<ChartConfig>(() => {
    const saved = loadChartConfig();
    if (saved) {
      // Validate saved agents still exist
      const validAgents = saved.selectedAgents.filter((a) => allAgents.includes(a));
      return {
        ...saved,
        selectedAgents: validAgents.length > 0 ? validAgents : allAgents.slice(0, 3),
        dateRangeEnd: Math.min(saved.dateRangeEnd, allDates.length - 1),
      };
    }
    return {
      selectedAgents: allAgents.slice(0, 3),
      selectedMetrics: ['tq'],
      showDeptAvg: true,
      showSeniorAvg: false,
      showNonSeniorAvg: false,
      dateRangeStart: 0,
      dateRangeEnd: allDates.length - 1,
    };
  });

  // Regression state - default to 50% which is more realistic for noisy daily data
  const [showTrendLines, setShowTrendLines] = useState(false);
  const [rSquaredThreshold, setRSquaredThreshold] = useState(0.10);

  // Save config when it changes
  useEffect(() => {
    saveChartConfig(config);
  }, [config]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return mergeSeriesForChart(
      timeSeriesData,
      config.selectedAgents,
      config.selectedMetrics,
      config.showDeptAvg,
      config.showSeniorAvg,
      config.showNonSeniorAvg,
      config.dateRangeStart,
      config.dateRangeEnd
    );
  }, [timeSeriesData, config]);

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
  const toggleAvg = useCallback((type: 'dept' | 'senior' | 'nonsenior') => {
    setConfig((prev) => {
      switch (type) {
        case 'dept':
          return { ...prev, showDeptAvg: !prev.showDeptAvg };
        case 'senior':
          return { ...prev, showSeniorAvg: !prev.showSeniorAvg };
        case 'nonsenior':
          return { ...prev, showNonSeniorAvg: !prev.showNonSeniorAvg };
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

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">Agents</label>
            <div className="space-x-2">
              <button
                onClick={selectAllAgents}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                All
              </button>
              <button
                onClick={deselectAllAgents}
                className="text-xs text-slate-400 hover:text-slate-300"
              >
                None
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto bg-slate-900/50 rounded-lg p-2 space-y-1">
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
                  className="w-3 h-3 rounded-full"
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

        {/* Metric Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Metrics</label>
          <div className="flex flex-wrap gap-2">
            {ALL_METRICS.map((metric) => (
              <button
                key={metric}
                onClick={() => toggleMetric(metric)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  config.selectedMetrics.includes(metric)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {METRIC_LABELS[metric]}
              </button>
            ))}
          </div>

          {/* Average Lines */}
          <label className="text-sm font-medium text-slate-300 block mt-4">
            Average Lines
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleAvg('dept')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                config.showDeptAvg
                  ? 'bg-gray-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Department Avg
            </button>
            <button
              onClick={() => toggleAvg('senior')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                config.showSeniorAvg
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Senior Avg
            </button>
            <button
              onClick={() => toggleAvg('nonsenior')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                config.showNonSeniorAvg
                  ? 'bg-slate-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Non-Senior Avg
            </button>
          </div>

          {/* Trend Lines */}
          <label className="text-sm font-medium text-slate-300 block mt-4">
            Trend Analysis
          </label>
          <div className="space-y-2">
            <button
              onClick={() => setShowTrendLines(!showTrendLines)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showTrendLines
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Trend Lines {showTrendLines && `(${regressions.size} fit)`}
            </button>
            {showTrendLines && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400">R² ≥</span>
                <input
                  type="range"
                  min={0}
                  max={0.99}
                  step={0.01}
                  value={rSquaredThreshold}
                  onChange={(e) => setRSquaredThreshold(parseFloat(e.target.value))}
                  className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs text-emerald-400 font-mono w-12">
                  {(rSquaredThreshold * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Date Range</label>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>{allDates[config.dateRangeStart] || ''}</span>
              <span className="text-slate-600">to</span>
              <span>{allDates[config.dateRangeEnd] || ''}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-10">Start</span>
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
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-10">End</span>
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
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-900/50 rounded-xl p-4">
        {chartDataWithTrends.length === 0 || config.selectedAgents.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-slate-400">
            Select at least one agent to view trends
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={chartDataWithTrends} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#64748b"
                fontSize={12}
                tickMargin={10}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                stroke="#64748b"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f1f5f9' }}
                formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`]}
                labelFormatter={(label) => formatDate(label as string)}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value: string) => {
                  // Clean up legend names
                  const parts = value.split('_');
                  if (parts.length === 2) {
                    const [name, metric] = parts;
                    if (name === 'dept') return `Dept Avg (${METRIC_LABELS[metric as keyof typeof METRIC_LABELS]})`;
                    if (name === 'senior') return `Senior Avg (${METRIC_LABELS[metric as keyof typeof METRIC_LABELS]})`;
                    if (name === 'nonsenior') return `Non-Senior Avg (${METRIC_LABELS[metric as keyof typeof METRIC_LABELS]})`;
                    return `${name} (${METRIC_LABELS[metric as keyof typeof METRIC_LABELS]})`;
                  }
                  return value;
                }}
              />

              {/* Agent lines */}
              {config.selectedAgents.map((agent) =>
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`${agent}_${metric}`}
                    type="monotone"
                    dataKey={`${agent}_${metric}`}
                    name={`${agent}_${metric}`}
                    stroke={getAgentColor(allAgents.indexOf(agent))}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                    strokeDasharray={
                      metric === 'tq' ? undefined :
                      metric === 'tp' ? '5 5' :
                      metric === 'pq' ? '2 2' :
                      metric === 'hp' ? '8 2' :
                      metric === 'bk' ? '4 4' :
                      '1 3'
                    }
                  />
                ))
              )}

              {/* Average lines */}
              {config.showDeptAvg &&
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`dept_${metric}`}
                    type="monotone"
                    dataKey={`dept_${metric}`}
                    name={`dept_${metric}`}
                    stroke="#6B7280"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
                  />
                ))}

              {config.showSeniorAvg &&
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`senior_${metric}`}
                    type="monotone"
                    dataKey={`senior_${metric}`}
                    name={`senior_${metric}`}
                    stroke="#F59E0B"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
                  />
                ))}

              {config.showNonSeniorAvg &&
                config.selectedMetrics.map((metric) => (
                  <Line
                    key={`nonsenior_${metric}`}
                    type="monotone"
                    dataKey={`nonsenior_${metric}`}
                    name={`nonsenior_${metric}`}
                    stroke="#94A3B8"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
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
                        stroke={getAgentColor(allAgents.indexOf(agent))}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        strokeOpacity={0.7}
                        dot={false}
                        connectNulls
                        legendType="none"
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
                      stroke="#6B7280"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      strokeOpacity={0.7}
                      dot={false}
                      connectNulls
                      legendType="none"
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
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      strokeOpacity={0.7}
                      dot={false}
                      connectNulls
                      legendType="none"
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
                      stroke="#94A3B8"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      strokeOpacity={0.7}
                      dot={false}
                      connectNulls
                      legendType="none"
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
      <div className="text-xs text-slate-500 flex flex-wrap gap-4">
        <span>T&gt;Q = Trips to Quotes %</span>
        <span>T&gt;P = Trips to Passthroughs %</span>
        <span>P&gt;Q = Passthroughs to Quotes %</span>
        <span>Hot Pass = Hot Passes / Passthroughs %</span>
        <span>Bookings = Bookings / Trips %</span>
        <span>% Non-Conv = Non-Converted / Trips %</span>
      </div>
    </div>
  );
};
