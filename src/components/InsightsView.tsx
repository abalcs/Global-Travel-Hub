import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import type { RawParsedData } from '../utils/indexedDB';
import {
  generateInsightsData,
  generateAIInsights,
  discoverColumns,
  analyzeRegionalPerformance,
  analyzeRegionalPerformanceByAgent,
  type InsightsData,
  type RegionalTimeframe,
  type DepartmentRegionalPerformance,
  type AgentRegionalPerformance,
} from '../utils/insightsAnalytics';
import {
  loadAnthropicApiKey,
  saveAnthropicApiKey,
} from '../utils/storage';

interface InsightsViewProps {
  rawData: RawParsedData;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export const InsightsView: React.FC<InsightsViewProps> = ({ rawData }) => {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [selectedAgentForReasons, setSelectedAgentForReasons] = useState<string>('');
  const [regionalTimeframe, setRegionalTimeframe] = useState<RegionalTimeframe>('all');
  const [selectedAgentForRegions, setSelectedAgentForRegions] = useState<string>('');

  // Load API key
  useEffect(() => {
    const storedKey = loadAnthropicApiKey();
    if (storedKey) {
      setApiKey(storedKey);
      setApiKeySaved(true);
    }
  }, []);

  // Generate insights when raw data changes
  useEffect(() => {
    if (rawData) {
      const data = generateInsightsData(rawData);
      setInsights(data);
    }
  }, [rawData]);

  const columns = useMemo(() => discoverColumns(rawData), [rawData]);

  // Regional performance with timeframe filtering
  const filteredRegionalPerformance = useMemo<DepartmentRegionalPerformance | null>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return null;
    return analyzeRegionalPerformance(rawData.trips, regionalTimeframe);
  }, [rawData.trips, regionalTimeframe]);

  const filteredAgentRegionalPerformance = useMemo<AgentRegionalPerformance[]>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return [];
    return analyzeRegionalPerformanceByAgent(rawData.trips, regionalTimeframe);
  }, [rawData.trips, regionalTimeframe]);

  const selectedAgentRegionalData = useMemo(() => {
    return filteredAgentRegionalPerformance.find(a => a.agentName === selectedAgentForRegions);
  }, [filteredAgentRegionalPerformance, selectedAgentForRegions]);

  // Prepare trend chart data
  const trendChartData = useMemo(() => {
    if (!insights?.regionalTrends) return [];
    const { periods, topRegionsByPeriod } = insights.regionalTrends;

    // Get top 5 regions across all periods
    const regionCounts: Record<string, number> = {};
    for (const period of periods) {
      const regions = topRegionsByPeriod.get(period) || [];
      for (const r of regions.slice(0, 3)) {
        regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
      }
    }

    const topRegions = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([region]) => region);

    // Build chart data
    return periods.map(period => {
      const periodData: Record<string, number | string> = { period };
      const regions = topRegionsByPeriod.get(period) || [];

      for (const region of topRegions) {
        const regionPerf = regions.find(r => r.region === region);
        periodData[region] = regionPerf ? parseFloat(regionPerf.tpRate.toFixed(1)) : 0;
      }

      return periodData;
    });
  }, [insights?.regionalTrends]);

  const trendRegions = useMemo(() => {
    if (trendChartData.length === 0) return [];
    const keys = Object.keys(trendChartData[0] || {}).filter(k => k !== 'period');
    return keys;
  }, [trendChartData]);

  const handleSaveApiKey = useCallback(() => {
    if (apiKey) {
      saveAnthropicApiKey(apiKey);
      setApiKeySaved(true);
    }
  }, [apiKey]);

  const handleGenerateAIAnalysis = useCallback(async () => {
    if (!insights || !apiKey) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateAIInsights(insights, apiKey);
      setAiAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI analysis');
    } finally {
      setIsLoading(false);
    }
  }, [insights, apiKey]);

  const renderAnalysis = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <h4 key={index} className="font-bold text-white mt-4 mb-2">
            {line.replace(/\*\*/g, '')}
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li key={index} className="ml-4 text-slate-300 mb-1">
            {line.substring(2)}
          </li>
        );
      }
      if (line.trim()) {
        return (
          <p key={index} className="text-slate-300 mb-2">
            {line}
          </p>
        );
      }
      return null;
    });
  };

  if (!insights) {
    return (
      <div className="text-center py-16 text-slate-400">
        Loading insights...
      </div>
    );
  }

  const selectedAgentReasons = insights.agentNonValidated.find(
    a => a.agentName === selectedAgentForReasons
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Department Insights
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Statistical analysis and AI-powered recommendations
          </p>
        </div>
        <button
          onClick={() => setShowColumns(!showColumns)}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          {showColumns ? 'Hide' : 'Show'} available columns
        </button>
      </div>

      {/* Column Discovery (debug) */}
      {showColumns && (
        <div className="bg-slate-900/50 rounded-xl p-4 text-xs">
          <h4 className="font-medium text-slate-300 mb-2">Available Columns by File:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(columns).map(([file, cols]) => (
              <div key={file}>
                <span className="text-indigo-400 font-medium">{file}:</span>
                <ul className="text-slate-500 mt-1">
                  {cols.slice(0, 8).map(col => (
                    <li key={col} className="truncate">{col}</li>
                  ))}
                  {cols.length > 8 && <li>...+{cols.length - 8} more</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{insights.totalPassthroughs.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Total Passthroughs</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{insights.totalHotPass.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Total Hot Passes</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{insights.totalBookings.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Total Bookings</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{insights.totalNonValidated.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Non-Validated Leads</div>
        </div>
      </div>

      {/* Best Day/Time Cards - Passthroughs */}
      {(insights.bestPassthroughDay || insights.bestPassthroughTime) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.bestPassthroughDay && (
            <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-xl p-4 border border-indigo-500/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-indigo-300">Best Day for Passthroughs</div>
                  <div className="text-xl font-bold text-white">{insights.bestPassthroughDay}</div>
                  <div className="text-xs text-slate-400">
                    {insights.passthroughsByDay[0]?.count.toLocaleString()} passthroughs ({insights.passthroughsByDay[0]?.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          )}
          {insights.bestPassthroughTime && (
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-purple-300">Best Time for Passthroughs</div>
                  <div className="text-xl font-bold text-white">{insights.bestPassthroughTime}</div>
                  <div className="text-xs text-slate-400">
                    {insights.passthroughsByTime[0]?.count.toLocaleString()} passthroughs ({insights.passthroughsByTime[0]?.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Best Day/Time Cards - Hot Passes */}
      {(insights.bestHotPassDay || insights.bestHotPassTime) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.bestHotPassDay && (
            <div className="bg-gradient-to-br from-orange-600/20 to-amber-600/20 rounded-xl p-4 border border-orange-500/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-orange-300">Best Day for Hot Passes</div>
                  <div className="text-xl font-bold text-white">{insights.bestHotPassDay}</div>
                  <div className="text-xs text-slate-400">
                    {insights.hotPassByDay[0]?.count.toLocaleString()} hot passes ({insights.hotPassByDay[0]?.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          )}
          {insights.bestHotPassTime && (
            <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/20 rounded-xl p-4 border border-amber-500/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-amber-300">Best Time for Hot Passes</div>
                  <div className="text-xl font-bold text-white">{insights.bestHotPassTime}</div>
                  <div className="text-xs text-slate-400">
                    {insights.hotPassByTime[0]?.count.toLocaleString()} hot passes ({insights.hotPassByTime[0]?.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Passthroughs by Day */}
        {insights.passthroughsByDay.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Passthroughs by Day of Week</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={insights.passthroughsByDay.map(d => ({ ...d, label: `${d.percentage.toFixed(1)}%` }))}>
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#e2e8f0', fontSize: 11, dataKey: 'label' }} activeBar={false}>
                  {insights.passthroughsByDay.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Passthroughs by Time */}
        {insights.hasTimeData && insights.passthroughsByTime.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Passthroughs by Time of Day</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={insights.passthroughsByTime.map(t => ({ ...t, label: `${t.percentage.toFixed(1)}%` }))} layout="vertical">
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="timeSlot" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#e2e8f0', fontSize: 11, dataKey: 'label' }} activeBar={false}>
                  {insights.passthroughsByTime.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!insights.hasTimeData && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center justify-center">
            <div className="text-center text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">Time-of-day data not available</p>
              <p className="text-xs mt-1">Timestamps may only include dates</p>
            </div>
          </div>
        )}
      </div>

      {/* Hot Pass Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot Passes by Day */}
        {insights.hotPassByDay.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Hot Passes by Day of Week</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={insights.hotPassByDay.map(d => ({ ...d, label: `${d.percentage.toFixed(1)}%` }))}>
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#f97316" label={{ position: 'top', fill: '#e2e8f0', fontSize: 11, dataKey: 'label' }} activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Hot Passes by Time */}
        {insights.hasHotPassTimeData && insights.hotPassByTime.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Hot Passes by Time of Day</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={insights.hotPassByTime.map(t => ({ ...t, label: `${t.percentage.toFixed(1)}%` }))} layout="vertical">
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="timeSlot" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#f59e0b" label={{ position: 'right', fill: '#e2e8f0', fontSize: 11, dataKey: 'label' }} activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {insights.hotPassByDay.length > 0 && !insights.hasHotPassTimeData && (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center justify-center">
            <div className="text-center text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">Hot pass time-of-day data not available</p>
              <p className="text-xs mt-1">Timestamps may only include dates</p>
            </div>
          </div>
        )}
      </div>

      {/* Regional Performance Section */}
      {(filteredRegionalPerformance && filteredRegionalPerformance.allRegions.length > 0) && (
        <div className="space-y-6">
          {/* Section Header with Timeframe Toggle */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Regional T&gt;P Performance
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Trip-to-Passthrough conversion rates by region/country
              </p>
            </div>
            <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
              {[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'quarter', label: 'Quarter' },
                { value: 'ytd', label: 'YTD' },
                { value: 'all', label: 'All Time' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setRegionalTimeframe(value as RegionalTimeframe)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    regionalTimeframe === value
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Department Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-white">{filteredRegionalPerformance.totalTrips.toLocaleString()}</div>
              <div className="text-sm text-slate-400">Total Trips</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-white">{filteredRegionalPerformance.totalPassthroughs.toLocaleString()}</div>
              <div className="text-sm text-slate-400">Passthroughs</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-teal-400">{filteredRegionalPerformance.overallTpRate.toFixed(1)}%</div>
              <div className="text-sm text-slate-400">Overall T&gt;P Rate</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-white">{filteredRegionalPerformance.allRegions.length}</div>
              <div className="text-sm text-slate-400">Regions Tracked</div>
            </div>
          </div>

          {/* Top & Bottom Regions Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Performing Regions */}
            <div className="bg-gradient-to-br from-teal-600/20 to-emerald-600/20 rounded-xl p-4 border border-teal-500/30">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <h4 className="text-sm font-medium text-teal-300">Top Performing Regions</h4>
              </div>
              <div className="space-y-2">
                {filteredRegionalPerformance.topRegions.slice(0, 5).map((region, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-teal-400 font-bold w-5">{i + 1}.</span>
                      <span className="text-sm text-white truncate max-w-[180px]">{region.region}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-teal-400">{region.tpRate.toFixed(1)}%</span>
                      <span className="text-xs text-slate-500 ml-2">({region.passthroughs}/{region.trips})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Performing Regions */}
            <div className="bg-gradient-to-br from-rose-600/20 to-red-600/20 rounded-xl p-4 border border-rose-500/30">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                <h4 className="text-sm font-medium text-rose-300">Needs Improvement</h4>
              </div>
              <div className="space-y-2">
                {filteredRegionalPerformance.bottomRegions.slice(0, 5).map((region, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-400 font-bold w-5">{filteredRegionalPerformance.allRegions.length - 4 + i}.</span>
                      <span className="text-sm text-white truncate max-w-[180px]">{region.region}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-rose-400">{region.tpRate.toFixed(1)}%</span>
                      <span className="text-xs text-slate-500 ml-2">({region.passthroughs}/{region.trips})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Regional Performance Bar Chart */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 mb-4">Department Regional T&gt;P Rates (Top 10)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={filteredRegionalPerformance.allRegions.slice(0, 10).map(r => ({
                  region: r.region.length > 20 ? r.region.substring(0, 20) + '...' : r.region,
                  tpRate: parseFloat(r.tpRate.toFixed(1)),
                  trips: r.trips,
                  passthroughs: r.passthroughs,
                }))}
                layout="vertical"
                margin={{ left: 10, right: 30 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="region"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={150}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  formatter={(value, _name, props) => {
                    const payload = props?.payload as { trips: number; passthroughs: number } | undefined;
                    if (value === undefined || !payload) return ['', ''];
                    return [`${value}% (${payload.passthroughs}/${payload.trips} trips)`, 'T>P Rate'];
                  }}
                />
                <Bar
                  dataKey="tpRate"
                  radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fill: '#e2e8f0', fontSize: 11, formatter: (v) => `${v}%` }}
                  activeBar={false}
                >
                  {filteredRegionalPerformance.allRegions.slice(0, 10).map((_, index) => (
                    <Cell key={index} fill={index < 3 ? '#14b8a6' : index < 7 ? '#6366f1' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Agent Regional Performance */}
          {filteredAgentRegionalPerformance.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h4 className="text-sm font-medium text-slate-300 mb-4">Agent Regional Performance</h4>
              <div className="flex flex-wrap gap-4">
                <select
                  value={selectedAgentForRegions}
                  onChange={(e) => setSelectedAgentForRegions(e.target.value)}
                  className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white min-w-[200px]"
                >
                  <option value="">Select agent...</option>
                  {filteredAgentRegionalPerformance.map(a => (
                    <option key={a.agentName} value={a.agentName}>
                      {a.agentName} ({a.totalTrips} trips, {a.overallTpRate.toFixed(1)}% T&gt;P)
                    </option>
                  ))}
                </select>

                {selectedAgentRegionalData && (
                  <div className="flex-1 min-w-[300px]">
                    <div className="text-sm text-white mb-3">
                      <strong>{selectedAgentRegionalData.agentName}</strong> - {selectedAgentRegionalData.totalTrips} trips,{' '}
                      <span className="text-teal-400">{selectedAgentRegionalData.overallTpRate.toFixed(1)}% overall T&gt;P</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-teal-400 mb-2 font-medium">Strong Regions</div>
                        <div className="space-y-1">
                          {selectedAgentRegionalData.topRegions.map((r, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300 truncate max-w-[150px]">{r.region}</span>
                              <span className="text-teal-400 font-medium">{r.tpRate.toFixed(1)}%</span>
                            </div>
                          ))}
                          {selectedAgentRegionalData.topRegions.length === 0 && (
                            <div className="text-slate-500 text-xs">No regions with enough data</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-rose-400 mb-2 font-medium">Needs Improvement</div>
                        <div className="space-y-1">
                          {selectedAgentRegionalData.bottomRegions.map((r, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300 truncate max-w-[150px]">{r.region}</span>
                              <span className="text-rose-400 font-medium">{r.tpRate.toFixed(1)}%</span>
                            </div>
                          ))}
                          {selectedAgentRegionalData.bottomRegions.length === 0 && (
                            <div className="text-slate-500 text-xs">No regions with enough data</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Regional Trends Chart */}
          {trendChartData.length > 0 && trendRegions.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h4 className="text-sm font-medium text-slate-300 mb-4">Regional T&gt;P Trends Over Time</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendChartData} margin={{ left: 10, right: 30 }}>
                  <XAxis
                    dataKey="period"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 'auto']}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    formatter={(value) => value !== undefined ? [`${value}%`, 'T>P Rate'] : ['', '']}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-slate-300">{value}</span>}
                    wrapperStyle={{ fontSize: '10px' }}
                  />
                  {trendRegions.map((region, i) => (
                    <Line
                      key={region}
                      type="monotone"
                      dataKey={region}
                      name={region}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: COLORS[i % COLORS.length], strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Non-Validated Reasons */}
      {insights.hasNonValidatedReasons && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Top Non-Validated Reasons (Department)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={insights.topNonValidatedReasons.slice(0, 6).map(r => ({
                      name: r.reason,
                      value: r.count,
                      pct: r.percentage,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ payload }) => `${(payload?.pct as number)?.toFixed(0) || 0}%`}
                    labelLine={false}
                  >
                    {insights.topNonValidatedReasons.slice(0, 6).map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-slate-300">{value}</span>}
                    wrapperStyle={{ fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {insights.topNonValidatedReasons.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm text-slate-300 truncate max-w-[200px]">{r.reason}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">{r.count.toLocaleString()}</span>
                    <span className="text-xs text-slate-500 ml-2">({r.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Agent-Level Non-Validated */}
      {insights.agentNonValidated.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Non-Validated Reasons by Agent</h3>
          <div className="flex flex-wrap gap-4">
            <select
              value={selectedAgentForReasons}
              onChange={(e) => setSelectedAgentForReasons(e.target.value)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Select agent...</option>
              {insights.agentNonValidated.map(a => (
                <option key={a.agentName} value={a.agentName}>
                  {a.agentName} ({a.total})
                </option>
              ))}
            </select>

            {selectedAgentReasons && (
              <div className="flex-1 min-w-[300px]">
                <div className="text-sm text-white mb-2">
                  <strong>{selectedAgentReasons.agentName}</strong> - {selectedAgentReasons.total} non-validated leads
                </div>
                <div className="space-y-1">
                  {selectedAgentReasons.topReasons.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{r.reason}</span>
                      <span className="text-white">{r.count} ({r.percentage.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis Section */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI-Powered Analysis
        </h3>

        {!apiKeySaved && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Anthropic API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-500"
              >
                Save
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleGenerateAIAnalysis}
          disabled={isLoading || !apiKey}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate AI Insights
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {aiAnalysis && (
          <div className="mt-6 p-6 bg-slate-700/30 rounded-xl border border-slate-600/50">
            <div className="prose prose-invert prose-sm max-w-none">
              <ul className="list-none p-0 m-0">{renderAnalysis(aiAnalysis)}</ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
