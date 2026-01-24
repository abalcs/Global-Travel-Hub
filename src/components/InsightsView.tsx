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
} from 'recharts';
import type { RawParsedData } from '../utils/indexedDB';
import {
  generateInsightsData,
  generateAIInsights,
  discoverColumns,
  type InsightsData,
  type RegionalTimeframe,
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
  const [timeframe, setTimeframe] = useState<RegionalTimeframe>('all');
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [selectedAgentForReasons, setSelectedAgentForReasons] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    timing: true,
    leadQuality: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Load API key
  useEffect(() => {
    const storedKey = loadAnthropicApiKey();
    if (storedKey) {
      setApiKey(storedKey);
      setApiKeySaved(true);
    }
  }, []);

  // Generate insights when raw data or timeframe changes
  useEffect(() => {
    if (rawData) {
      const data = generateInsightsData(rawData, timeframe);
      setInsights(data);
    }
  }, [rawData, timeframe]);

  const columns = useMemo(() => discoverColumns(rawData), [rawData]);

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

  // Section Header component for consistency
  const SectionHeader = ({
    title,
    icon,
    iconColor,
    section,
    subtitle
  }: {
    title: string;
    icon: React.ReactNode;
    iconColor: string;
    section: string;
    subtitle?: string;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-all cursor-pointer active:scale-[0.99] group"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 ${iconColor} rounded-lg`}>
          {icon}
        </div>
        <div className="text-left">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <svg
        className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections[section] ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
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
          {showColumns ? 'Hide' : 'Show'} columns
        </button>
      </div>

      {/* Time Period Selector */}
      <div className="flex flex-wrap gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        {[
          { value: 'lastWeek', label: 'Last Week' },
          { value: 'thisMonth', label: 'This Month' },
          { value: 'lastMonth', label: 'Last Month' },
          { value: 'thisQuarter', label: 'This Qtr' },
          { value: 'lastQuarter', label: 'Last Qtr' },
          { value: 'lastYear', label: 'Last Year' },
          { value: 'all', label: 'All Time' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeframe(value as RegionalTimeframe)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              timeframe === value
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Column Discovery (debug) */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          showColumns ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
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
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800/40 rounded-lg p-3 text-center border border-slate-700/30">
          <div className="text-lg font-bold text-white">{insights.totalPassthroughs.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Passthroughs</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-3 text-center border border-slate-700/30">
          <div className="text-lg font-bold text-white">{insights.totalHotPass.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Hot Passes</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-3 text-center border border-slate-700/30">
          <div className="text-lg font-bold text-white">{insights.totalBookings.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Bookings</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-3 text-center border border-slate-700/30">
          <div className="text-lg font-bold text-white">{insights.totalNonValidated.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Non-Validated</div>
        </div>
      </div>

      {/* ==================== TIMING INSIGHTS SECTION ==================== */}
      <div className="space-y-4">
        <SectionHeader
          title="Timing Insights"
          icon={<svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>}
          iconColor="bg-purple-500/20"
          section="timing"
          subtitle="Best days and times for passthroughs and hot passes"
        />

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            expandedSections.timing ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-4 pl-2 border-l-2 border-purple-500/20">
            {/* Best Day/Time Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {insights.bestPassthroughDay && (
                <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-lg p-3 border border-indigo-500/30">
                  <div className="text-xs text-indigo-300 mb-1">Best Day - Passthroughs</div>
                  <div className="text-lg font-bold text-white">{insights.bestPassthroughDay}</div>
                  <div className="text-xs text-slate-400">{insights.passthroughsByDay[0]?.percentage.toFixed(0)}% of total</div>
                </div>
              )}
              {insights.bestPassthroughTime && (
                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg p-3 border border-purple-500/30">
                  <div className="text-xs text-purple-300 mb-1">Best Time - Passthroughs</div>
                  <div className="text-lg font-bold text-white">{insights.bestPassthroughTime.split(' ')[0]}</div>
                  <div className="text-xs text-slate-400">{insights.passthroughsByTime[0]?.percentage.toFixed(0)}% of total</div>
                </div>
              )}
              {insights.bestHotPassDay && (
                <div className="bg-gradient-to-br from-orange-600/20 to-amber-600/20 rounded-lg p-3 border border-orange-500/30">
                  <div className="text-xs text-orange-300 mb-1">Best Day - Hot Passes</div>
                  <div className="text-lg font-bold text-white">{insights.bestHotPassDay}</div>
                  <div className="text-xs text-slate-400">{insights.hotPassByDay[0]?.percentage.toFixed(0)}% of total</div>
                </div>
              )}
              {insights.bestHotPassTime && (
                <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/20 rounded-lg p-3 border border-amber-500/30">
                  <div className="text-xs text-amber-300 mb-1">Best Time - Hot Passes</div>
                  <div className="text-lg font-bold text-white">{insights.bestHotPassTime.split(' ')[0]}</div>
                  <div className="text-xs text-slate-400">{insights.hotPassByTime[0]?.percentage.toFixed(0)}% of total</div>
                </div>
              )}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Passthroughs by Day */}
              {insights.passthroughsByDay.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <h4 className="text-xs font-medium text-slate-400 mb-3">Passthroughs by Day</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={insights.passthroughsByDay.map(d => ({ ...d, label: `${d.percentage.toFixed(0)}%` }))}>
                      <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} activeBar={false}>
                        {insights.passthroughsByDay.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Hot Passes by Day */}
              {insights.hotPassByDay.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <h4 className="text-xs font-medium text-slate-400 mb-3">Hot Passes by Day</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={insights.hotPassByDay.map(d => ({ ...d, label: `${d.percentage.toFixed(0)}%` }))}>
                      <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#f97316" activeBar={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Passthroughs by Time */}
              {insights.hasTimeData && insights.passthroughsByTime.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <h4 className="text-xs font-medium text-slate-400 mb-3">Passthroughs by Time</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={insights.passthroughsByTime} layout="vertical">
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="timeSlot" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} activeBar={false}>
                        {insights.passthroughsByTime.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Hot Passes by Time */}
              {insights.hasHotPassTimeData && insights.hotPassByTime.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <h4 className="text-xs font-medium text-slate-400 mb-3">Hot Passes by Time</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={insights.hotPassByTime} layout="vertical">
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="timeSlot" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#f59e0b" activeBar={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== LEAD QUALITY SECTION ==================== */}
      {(insights.hasNonValidatedReasons || insights.agentNonValidated.length > 0) && (
        <div className="space-y-4">
          <SectionHeader
            title="Lead Quality"
            icon={<svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>}
            iconColor="bg-rose-500/20"
            section="leadQuality"
            subtitle="Non-validated lead analysis and reasons"
          />

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.leadQuality ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-4 pl-2 border-l-2 border-rose-500/20">
              {/* Non-Validated Reasons */}
              {insights.hasNonValidatedReasons && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <h4 className="text-sm font-medium text-slate-300 mb-4">Top Non-Validated Reasons</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <ResponsiveContainer width="100%" height={200}>
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
                            outerRadius={70}
                            label={({ payload }) => `${(payload?.pct as number)?.toFixed(0) || 0}%`}
                            labelLine={false}
                          >
                            {insights.topNonValidatedReasons.slice(0, 6).map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#e2e8f0' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {insights.topNonValidatedReasons.slice(0, 6).map((r, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-xs text-slate-300 truncate max-w-[150px]">{r.reason}</span>
                          </div>
                          <span className="text-xs font-medium text-white">{r.percentage.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Agent-Level Non-Validated */}
              {insights.agentNonValidated.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <h4 className="text-sm font-medium text-slate-300 mb-4">By Agent</h4>
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
                          <strong>{selectedAgentReasons.agentName}</strong> - {selectedAgentReasons.total} non-validated
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== AI ANALYSIS SECTION ==================== */}
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
