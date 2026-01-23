import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesData } from '../types';
import { calculateQuartileAnalysis } from '../utils/quartileAnalytics';

interface QuartileAnalysisSectionProps {
  timeSeriesData: TimeSeriesData;
  dateStartIdx: number;
  dateEndIdx: number;
  allDates: string[];
}

export const QuartileAnalysisSection: React.FC<QuartileAnalysisSectionProps> = ({
  timeSeriesData,
  dateStartIdx,
  dateEndIdx,
  allDates,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [minVolume, setMinVolume] = useState(10);
  const [showIndividualAgents, setShowIndividualAgents] = useState(false);

  // Calculate quartile analysis data
  const analysisData = useMemo(() => {
    return calculateQuartileAnalysis(
      timeSeriesData,
      allDates,
      dateStartIdx,
      dateEndIdx,
      minVolume
    );
  }, [timeSeriesData, allDates, dateStartIdx, dateEndIdx, minVolume]);

  // Calculate individual agent daily T>Q data if enabled
  const individualAgentData = useMemo(() => {
    if (!showIndividualAgents || !analysisData) return null;

    const filteredDates = allDates.slice(dateStartIdx, dateEndIdx + 1);
    const allAgentNames = [
      ...analysisData.topQuartileAgents.map((a) => a.agentName),
      ...analysisData.bottomQuartileAgents.map((a) => a.agentName),
    ];

    // Build agent -> date -> metrics map
    const agentDateMap = new Map<string, Map<string, { trips: number; quotes: number }>>();
    for (const agent of timeSeriesData.agents) {
      if (allAgentNames.includes(agent.agentName)) {
        const dateMap = new Map<string, { trips: number; quotes: number }>();
        for (const day of agent.dailyMetrics) {
          dateMap.set(day.date, { trips: day.trips, quotes: day.quotes });
        }
        agentDateMap.set(agent.agentName, dateMap);
      }
    }

    // Build chart data with individual agent T>Q
    return filteredDates.map((date) => {
      const point: Record<string, unknown> = { date };

      for (const agentName of allAgentNames) {
        const dateMap = agentDateMap.get(agentName);
        const metrics = dateMap?.get(date);
        if (metrics && metrics.trips > 0) {
          point[agentName] = (metrics.quotes / metrics.trips) * 100;
        }
      }

      return point;
    });
  }, [showIndividualAgents, analysisData, timeSeriesData, allDates, dateStartIdx, dateEndIdx]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate average hot pass rates and bookings for summary
  const summaryStats = useMemo(() => {
    if (!analysisData) return null;

    const topAvgHP =
      analysisData.topQuartileAgents.reduce((sum, a) => sum + a.aggregateHotPassRate, 0) /
      analysisData.topQuartileAgents.length;
    const bottomAvgHP =
      analysisData.bottomQuartileAgents.reduce((sum, a) => sum + a.aggregateHotPassRate, 0) /
      analysisData.bottomQuartileAgents.length;

    // Calculate average bookings per agent
    const topAvgBookings =
      analysisData.topQuartileAgents.reduce((sum, a) => sum + a.totalBookings, 0) /
      analysisData.topQuartileAgents.length;
    const bottomAvgBookings =
      analysisData.bottomQuartileAgents.reduce((sum, a) => sum + a.totalBookings, 0) /
      analysisData.bottomQuartileAgents.length;

    // Calculate overall T>Q averages
    const validTopDays = analysisData.dailyComparison.filter((d) => d.topQuartileAgentCount > 0);
    const validBottomDays = analysisData.dailyComparison.filter((d) => d.bottomQuartileAgentCount > 0);

    const topAvgTQ = validTopDays.length > 0
      ? validTopDays.reduce((sum, d) => sum + d.topQuartileAvgTQ, 0) / validTopDays.length
      : 0;
    const bottomAvgTQ = validBottomDays.length > 0
      ? validBottomDays.reduce((sum, d) => sum + d.bottomQuartileAvgTQ, 0) / validBottomDays.length
      : 0;

    return { topAvgHP, bottomAvgHP, topAvgTQ, bottomAvgTQ, topAvgBookings, bottomAvgBookings };
  }, [analysisData]);

  // Agent colors for individual lines
  const getTopAgentColor = (index: number) => {
    const colors = ['#F97316', '#FB923C', '#FDBA74', '#FED7AA']; // Orange shades
    return colors[index % colors.length];
  };

  const getBottomAgentColor = (index: number) => {
    const colors = ['#64748B', '#94A3B8', '#CBD5E1', '#E2E8F0']; // Slate shades
    return colors[index % colors.length];
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-lg font-semibold text-white">Hot Pass Quartile Analysis</span>
          <span className="text-sm text-slate-400">
            {analysisData
              ? `(${analysisData.topQuartileAgents.length + analysisData.bottomQuartileAgents.length} agents)`
              : ''}
          </span>
        </div>
        {analysisData && summaryStats && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-orange-400">
              Top Q: {summaryStats.topAvgTQ.toFixed(1)}% T&gt;Q
            </span>
            <span className="text-slate-400">
              Bottom Q: {summaryStats.bottomAvgTQ.toFixed(1)}% T&gt;Q
            </span>
          </div>
        )}
      </button>

      {/* Expanded Content */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 space-y-4">
          {!analysisData ? (
            <div className="text-center py-8 text-slate-400">
              <p>Not enough agents with {minVolume}+ passthroughs to form quartiles.</p>
              <p className="text-sm mt-2">Need at least 4 qualifying agents.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-900/50 rounded-lg p-3 border border-orange-500/30">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Top Quartile</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-orange-400">
                      {analysisData.topQuartileAgents.length}
                    </span>
                    <span className="text-sm text-slate-400">agents</span>
                  </div>
                  <div className="text-sm text-orange-300 mt-1">
                    Avg HP: {summaryStats?.topAvgHP.toFixed(1)}%
                  </div>
                  <div className="text-sm text-orange-300">
                    Avg Bookings: {summaryStats?.topAvgBookings.toFixed(1)}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-500/30">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Bottom Quartile</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-400">
                      {analysisData.bottomQuartileAgents.length}
                    </span>
                    <span className="text-sm text-slate-500">agents</span>
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    Avg HP: {summaryStats?.bottomAvgHP.toFixed(1)}%
                  </div>
                  <div className="text-sm text-slate-400">
                    Avg Bookings: {summaryStats?.bottomAvgBookings.toFixed(1)}
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Date Range</div>
                  <div className="mt-1 text-sm text-white">
                    {analysisData.dateRange.start} to {analysisData.dateRange.end}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {dateEndIdx - dateStartIdx + 1} days
                  </div>
                </div>
              </div>

              {/* Controls Row */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-400">Min passthroughs:</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={minVolume}
                    onChange={(e) => setMinVolume(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowIndividualAgents(!showIndividualAgents)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    showIndividualAgents
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Show Individual Agents
                </button>
              </div>

              {/* Chart */}
              <div className="bg-slate-900/50 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={showIndividualAgents && individualAgentData ? individualAgentData : analysisData.dailyComparison}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      stroke="#64748b"
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      stroke="#64748b"
                      fontSize={12}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '12px',
                      }}
                      labelStyle={{ color: '#f1f5f9', fontWeight: 'bold', marginBottom: '8px' }}
                      formatter={(value: number | undefined, name?: string) => [
                        `${(value ?? 0).toFixed(1)}%`,
                        name === 'topQuartileAvgTQ' ? 'Top Quartile T>Q' :
                        name === 'bottomQuartileAvgTQ' ? 'Bottom Quartile T>Q' :
                        `${name ?? ''} T>Q`
                      ]}
                      labelFormatter={(label) => formatDate(label as string)}
                    />
                    <Legend
                      formatter={(value: string) =>
                        value === 'topQuartileAvgTQ' ? 'Top Quartile T>Q' :
                        value === 'bottomQuartileAvgTQ' ? 'Bottom Quartile T>Q' :
                        `${value} T>Q`
                      }
                    />

                    {/* Main quartile lines - always shown */}
                    {!showIndividualAgents && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="topQuartileAvgTQ"
                          name="topQuartileAvgTQ"
                          stroke="#F97316"
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="bottomQuartileAvgTQ"
                          name="bottomQuartileAvgTQ"
                          stroke="#64748B"
                          strokeWidth={3}
                          strokeDasharray="8 4"
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      </>
                    )}

                    {/* Individual agent lines */}
                    {showIndividualAgents && analysisData.topQuartileAgents.map((agent, idx) => (
                      <Line
                        key={agent.agentName}
                        type="monotone"
                        dataKey={agent.agentName}
                        name={agent.agentName}
                        stroke={getTopAgentColor(idx)}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                    {showIndividualAgents && analysisData.bottomQuartileAgents.map((agent, idx) => (
                      <Line
                        key={agent.agentName}
                        type="monotone"
                        dataKey={agent.agentName}
                        name={agent.agentName}
                        stroke={getBottomAgentColor(idx)}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Agent Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Quartile */}
                <div className="bg-slate-900/50 rounded-lg p-3 border border-orange-500/20">
                  <h4 className="text-sm font-medium text-orange-400 mb-2">
                    Top Quartile (Highest Hot Pass %)
                  </h4>
                  <div className="space-y-1">
                    {analysisData.topQuartileAgents.map((agent, idx) => (
                      <div
                        key={agent.agentName}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {showIndividualAgents && (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getTopAgentColor(idx) }}
                            />
                          )}
                          <span className="text-slate-300">{agent.agentName}</span>
                        </div>
                        <span className="text-orange-300 font-medium">
                          {agent.aggregateHotPassRate.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Quartile */}
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-500/20">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">
                    Bottom Quartile (Lowest Hot Pass %)
                  </h4>
                  <div className="space-y-1">
                    {analysisData.bottomQuartileAgents.map((agent, idx) => (
                      <div
                        key={agent.agentName}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {showIndividualAgents && (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getBottomAgentColor(idx) }}
                            />
                          )}
                          <span className="text-slate-300">{agent.agentName}</span>
                        </div>
                        <span className="text-slate-400 font-medium">
                          {agent.aggregateHotPassRate.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="text-xs text-slate-500">
                <p>
                  Agents are ranked by their aggregate Hot Pass % over the selected date range.
                  The chart compares T&gt;Q (trip to quote conversion) rates between the top and bottom quartiles.
                </p>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
