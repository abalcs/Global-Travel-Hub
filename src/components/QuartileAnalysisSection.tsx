import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { TimeSeriesData } from '../types';
import { calculateQuartileAnalysis } from '../utils/quartileAnalytics';
import { getTimeframeDates } from '../utils/dateParser';

type Timeframe = 'chart' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'lastYear' | 'all';

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
  const [isExpanded, setIsExpanded] = useState(true);
  const [minVolume, setMinVolume] = useState(10);
  const [timeframe, setTimeframe] = useState<Timeframe>('chart');

  // Calculate effective date range based on timeframe selection
  const effectiveDateRange = useMemo(() => {
    if (timeframe === 'chart') {
      // Use parent's date range (from the chart slider)
      return { start: dateStartIdx, end: dateEndIdx };
    }

    if (timeframe === 'all') {
      // Use all available dates
      return { start: 0, end: allDates.length - 1 };
    }

    // Calculate date range based on timeframe
    const { start: startDate, end: endDate } = getTimeframeDates(timeframe);

    if (!startDate || !endDate) {
      return { start: 0, end: allDates.length - 1 };
    }

    // Find the indices in allDates array that correspond to the timeframe
    let startIdx = 0;
    let endIdx = allDates.length - 1;

    // allDates are in YYYY-MM-DD format, sorted ascending
    for (let i = 0; i < allDates.length; i++) {
      const dateStr = allDates[i];
      const date = new Date(dateStr + 'T00:00:00');

      if (date >= startDate && startIdx === 0) {
        startIdx = i;
      }
      if (date <= endDate) {
        endIdx = i;
      }
    }

    // Ensure valid range
    if (startIdx > endIdx) {
      return { start: 0, end: allDates.length - 1 };
    }

    return { start: startIdx, end: endIdx };
  }, [timeframe, dateStartIdx, dateEndIdx, allDates]);

  // Calculate quartile analysis data
  const analysisData = useMemo(() => {
    return calculateQuartileAnalysis(
      timeSeriesData,
      allDates,
      effectiveDateRange.start,
      effectiveDateRange.end,
      minVolume
    );
  }, [timeSeriesData, allDates, effectiveDateRange.start, effectiveDateRange.end, minVolume]);

  // Calculate comparison metrics for the bar chart
  const comparisonData = useMemo(() => {
    if (!analysisData) return null;

    const topAgents = analysisData.topQuartileAgents;
    const bottomAgents = analysisData.bottomQuartileAgents;

    if (topAgents.length === 0 || bottomAgents.length === 0) return null;

    // Calculate averages for each metric
    const calcAvg = (agents: typeof topAgents, getter: (a: typeof topAgents[0]) => number) => {
      return agents.reduce((sum, a) => sum + getter(a), 0) / agents.length;
    };

    const topHotPass = calcAvg(topAgents, a => a.aggregateHotPassRate);
    const bottomHotPass = calcAvg(bottomAgents, a => a.aggregateHotPassRate);

    const topTQ = calcAvg(topAgents, a => a.totalTrips > 0 ? (a.totalQuotes / a.totalTrips) * 100 : 0);
    const bottomTQ = calcAvg(bottomAgents, a => a.totalTrips > 0 ? (a.totalQuotes / a.totalTrips) * 100 : 0);

    const topTP = calcAvg(topAgents, a => a.totalTrips > 0 ? (a.totalPassthroughs / a.totalTrips) * 100 : 0);
    const bottomTP = calcAvg(bottomAgents, a => a.totalTrips > 0 ? (a.totalPassthroughs / a.totalTrips) * 100 : 0);

    const topPQ = calcAvg(topAgents, a => a.totalPassthroughs > 0 ? (a.totalQuotes / a.totalPassthroughs) * 100 : 0);
    const bottomPQ = calcAvg(bottomAgents, a => a.totalPassthroughs > 0 ? (a.totalQuotes / a.totalPassthroughs) * 100 : 0);

    const topBookings = calcAvg(topAgents, a => a.totalBookings);
    const bottomBookings = calcAvg(bottomAgents, a => a.totalBookings);

    return [
      {
        metric: 'Hot Pass %',
        description: 'Passthroughs that become hot passes',
        top: topHotPass,
        bottom: bottomHotPass,
        diff: topHotPass - bottomHotPass,
        isPercent: true,
      },
      {
        metric: 'T>P %',
        description: 'Trips converted to passthroughs',
        top: topTP,
        bottom: bottomTP,
        diff: topTP - bottomTP,
        isPercent: true,
      },
      {
        metric: 'P>Q %',
        description: 'Passthroughs converted to quotes',
        top: topPQ,
        bottom: bottomPQ,
        diff: topPQ - bottomPQ,
        isPercent: true,
      },
      {
        metric: 'T>Q %',
        description: 'Trips converted to quotes',
        top: topTQ,
        bottom: bottomTQ,
        diff: topTQ - bottomTQ,
        isPercent: true,
      },
      {
        metric: 'Bookings',
        description: 'Average bookings per agent',
        top: topBookings,
        bottom: bottomBookings,
        diff: topBookings - bottomBookings,
        isPercent: false,
      },
    ];
  }, [analysisData]);

  // Summary insight
  const summaryInsight = useMemo(() => {
    if (!comparisonData) return null;

    const tqDiff = comparisonData.find(d => d.metric === 'T>Q %')?.diff || 0;
    const bookingsDiff = comparisonData.find(d => d.metric === 'Bookings')?.diff || 0;
    const hotPassDiff = comparisonData.find(d => d.metric === 'Hot Pass %')?.diff || 0;

    return {
      tqDiff,
      bookingsDiff,
      hotPassDiff,
    };
  }, [comparisonData]);

  const timeframeOptions: { value: Timeframe; label: string }[] = [
    { value: 'chart', label: 'Chart Range' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Qtr' },
    { value: 'lastQuarter', label: 'Last Qtr' },
    { value: 'lastYear', label: 'Last Year' },
    { value: 'all', label: 'All Time' },
  ];

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
          <span className="text-lg font-semibold text-white">Performance by Hot Pass Quartile</span>
          <span className="text-sm text-slate-400">
            {analysisData
              ? `(${analysisData.topQuartileAgents.length + analysisData.bottomQuartileAgents.length} agents)`
              : ''}
          </span>
        </div>
        {summaryInsight && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-orange-400">
              Top quartile: +{summaryInsight.tqDiff.toFixed(1)}pp T&gt;Q
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
            {/* Time Period Selector */}
            <div className="flex flex-wrap gap-1 bg-slate-900/50 p-1 rounded-lg w-fit">
              {timeframeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTimeframe(value);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    timeframe === value
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

          {!analysisData || !comparisonData ? (
            <div className="text-center py-8 text-slate-400">
              <p>Not enough agents with {minVolume}+ passthroughs to form quartiles.</p>
              <p className="text-sm mt-2">Need at least 4 qualifying agents.</p>
            </div>
          ) : (
            <>
              {/* Key Insight Banner */}
              <div className="bg-gradient-to-r from-orange-900/30 to-slate-800/30 rounded-lg p-4 border border-orange-500/20">
                <div className="flex items-start gap-3">
                  <div className="text-orange-400 text-xl">💡</div>
                  <div>
                    <div className="text-white font-medium">What does this show?</div>
                    <div className="text-slate-300 text-sm mt-1">
                      Agents are ranked by their <span className="text-orange-400 font-medium">Hot Pass %</span> (how often their passthroughs become "hot" leads).
                      We then compare the <span className="text-orange-400">top 25%</span> of agents against the <span className="text-slate-400">bottom 25%</span> across all key metrics.
                    </div>
                    {summaryInsight && (
                      <div className="text-slate-400 text-sm mt-2">
                        <span className="text-orange-400">Top performers</span> have {summaryInsight.hotPassDiff.toFixed(1)} percentage points higher hot pass rate,
                        and convert {summaryInsight.tqDiff.toFixed(1)} percentage points more trips to quotes.
                      </div>
                    )}
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
                <div className="text-xs text-slate-500">
                  Date range: {analysisData.dateRange.start} to {analysisData.dateRange.end}
                  {timeframe === 'chart' && (
                    <span className="text-orange-400 ml-1">(synced with chart)</span>
                  )}
                </div>
              </div>

              {/* Comparison Bar Chart */}
              <div className="bg-slate-900/50 rounded-xl p-4">
                <div className="flex items-center gap-6 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-500"></div>
                    <span className="text-sm text-slate-300">Top Quartile ({analysisData.topQuartileAgents.length} agents)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-500"></div>
                    <span className="text-sm text-slate-300">Bottom Quartile ({analysisData.bottomQuartileAgents.length} agents)</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {comparisonData.map((item) => (
                    <div key={item.metric} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-white">{item.metric}</span>
                          <span className="text-xs text-slate-500 ml-2">{item.description}</span>
                        </div>
                        <div className={`text-sm font-medium ${item.diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {item.diff >= 0 ? '+' : ''}{item.isPercent ? `${item.diff.toFixed(1)}pp` : item.diff.toFixed(1)}
                        </div>
                      </div>

                      <div className="relative h-8">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={[{ top: item.top, bottom: item.bottom }]}
                            margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                          >
                            <XAxis
                              type="number"
                              hide
                              domain={[0, Math.max(item.top, item.bottom) * 1.2 || 100]}
                            />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                padding: '8px',
                              }}
                              formatter={(value: number | undefined) => [
                                item.isPercent ? `${(value ?? 0).toFixed(1)}%` : (value ?? 0).toFixed(1),
                                ''
                              ]}
                            />
                            <Bar dataKey="top" fill="#F97316" radius={[4, 4, 4, 4]} barSize={12}>
                              <LabelList
                                dataKey="top"
                                position="right"
                                formatter={(v: unknown) => {
                                  const num = typeof v === 'number' ? v : 0;
                                  return item.isPercent ? `${num.toFixed(1)}%` : num.toFixed(1);
                                }}
                                style={{ fill: '#F97316', fontSize: 12, fontWeight: 500 }}
                              />
                            </Bar>
                            <Bar dataKey="bottom" fill="#64748B" radius={[4, 4, 4, 4]} barSize={12}>
                              <LabelList
                                dataKey="bottom"
                                position="right"
                                formatter={(v: unknown) => {
                                  const num = typeof v === 'number' ? v : 0;
                                  return item.isPercent ? `${num.toFixed(1)}%` : num.toFixed(1);
                                }}
                                style={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Quartile */}
                <div className="bg-slate-900/50 rounded-lg p-3 border border-orange-500/20">
                  <h4 className="text-sm font-medium text-orange-400 mb-2">
                    Top Quartile Agents
                  </h4>
                  <div className="space-y-1">
                    {analysisData.topQuartileAgents.map((agent) => (
                      <div
                        key={agent.agentName}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-300">{agent.agentName}</span>
                        <span className="text-orange-300 font-medium">
                          {agent.aggregateHotPassRate.toFixed(1)}% HP
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Quartile */}
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-500/20">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">
                    Bottom Quartile Agents
                  </h4>
                  <div className="space-y-1">
                    {analysisData.bottomQuartileAgents.map((agent) => (
                      <div
                        key={agent.agentName}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-300">{agent.agentName}</span>
                        <span className="text-slate-400 font-medium">
                          {agent.aggregateHotPassRate.toFixed(1)}% HP
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
