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
  analyzeRepeatClientPerformance,
  analyzeRepeatClientPerformanceByAgent,
  analyzeB2BPerformance,
  analyzeB2BPerformanceByAgent,
  type InsightsData,
  type RegionalTimeframe,
  type DepartmentClientSegmentPerformance,
  type AgentClientSegmentPerformance,
} from '../utils/insightsAnalytics';
import {
  loadAnthropicApiKey,
  saveAnthropicApiKey,
} from '../utils/storage';

interface InsightsViewProps {
  rawData: RawParsedData;
  seniors: string[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export const InsightsView: React.FC<InsightsViewProps> = ({ rawData, seniors }) => {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [selectedAgentForReasons, setSelectedAgentForReasons] = useState<string>('');
  const [repeatTimeframe, setRepeatTimeframe] = useState<RegionalTimeframe>('all');
  const [b2bTimeframe, setB2bTimeframe] = useState<RegionalTimeframe>('all');
  const [selectedAgentForRepeat, setSelectedAgentForRepeat] = useState<string>('');
  const [selectedAgentForB2B, setSelectedAgentForB2B] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    timing: true,
    clientSegments: true,
    leadQuality: false,
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

  // Generate insights when raw data changes
  useEffect(() => {
    if (rawData) {
      const data = generateInsightsData(rawData);
      setInsights(data);
    }
  }, [rawData]);

  const columns = useMemo(() => discoverColumns(rawData), [rawData]);

  // Repeat client performance analysis
  const repeatClientPerformance = useMemo<DepartmentClientSegmentPerformance | null>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return null;
    return analyzeRepeatClientPerformance(rawData.trips, repeatTimeframe);
  }, [rawData.trips, repeatTimeframe]);

  const repeatClientByAgent = useMemo<AgentClientSegmentPerformance[]>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return [];
    return analyzeRepeatClientPerformanceByAgent(rawData.trips, repeatTimeframe);
  }, [rawData.trips, repeatTimeframe]);

  const selectedRepeatAgentData = useMemo(() => {
    return repeatClientByAgent.find(a => a.agentName === selectedAgentForRepeat);
  }, [repeatClientByAgent, selectedAgentForRepeat]);

  // B2B performance analysis
  const b2bPerformance = useMemo<DepartmentClientSegmentPerformance | null>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return null;
    return analyzeB2BPerformance(rawData.trips, b2bTimeframe);
  }, [rawData.trips, b2bTimeframe]);

  const b2bByAgent = useMemo<AgentClientSegmentPerformance[]>(() => {
    if (!rawData.trips || rawData.trips.length === 0) return [];
    return analyzeB2BPerformanceByAgent(rawData.trips, b2bTimeframe);
  }, [rawData.trips, b2bTimeframe]);

  const selectedB2BAgentData = useMemo(() => {
    return b2bByAgent.find(a => a.agentName === selectedAgentForB2B);
  }, [b2bByAgent, selectedAgentForB2B]);

  // Create a Set for efficient senior lookup (case-insensitive)
  const seniorSet = useMemo(() => {
    return new Set(seniors.map(s => s.toLowerCase()));
  }, [seniors]);

  // Helper function to get T>P rate for repeat clients
  const getRepeatTpRate = (agent: AgentClientSegmentPerformance): number => {
    const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
    return repeatSeg?.tpRate ?? 0;
  };

  // Helper function to get T>P rate for B2B
  const getB2BTpRate = (agent: AgentClientSegmentPerformance): number => {
    const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
    return b2bSeg?.tpRate ?? 0;
  };

  // Repeat client rankings by senior/non-senior
  const repeatAgentRankings = useMemo(() => {
    // Filter agents who have repeat client data
    const agentsWithRepeatData = repeatClientByAgent.filter(a => {
      const repeatSeg = a.segments.find(s => s.segment === 'Repeat');
      return repeatSeg && repeatSeg.trips >= 3; // Minimum 3 repeat trips for meaningful data
    });

    const seniorAgents = agentsWithRepeatData
      .filter(a => seniorSet.has(a.agentName.toLowerCase()))
      .sort((a, b) => getRepeatTpRate(b) - getRepeatTpRate(a));

    const nonSeniorAgents = agentsWithRepeatData
      .filter(a => !seniorSet.has(a.agentName.toLowerCase()))
      .sort((a, b) => getRepeatTpRate(b) - getRepeatTpRate(a));

    return {
      seniorTop3: seniorAgents.slice(0, 3),
      seniorBottom3: seniorAgents.slice(-3).reverse(),
      nonSeniorTop3: nonSeniorAgents.slice(0, 3),
      nonSeniorBottom3: nonSeniorAgents.slice(-3).reverse(),
    };
  }, [repeatClientByAgent, seniorSet]);

  // B2B rankings by senior/non-senior
  const b2bAgentRankings = useMemo(() => {
    // Filter agents who have B2B data
    const agentsWithB2BData = b2bByAgent.filter(a => {
      const b2bSeg = a.segments.find(s => s.segment === 'B2B');
      return b2bSeg && b2bSeg.trips >= 3; // Minimum 3 B2B trips for meaningful data
    });

    const seniorAgents = agentsWithB2BData
      .filter(a => seniorSet.has(a.agentName.toLowerCase()))
      .sort((a, b) => getB2BTpRate(b) - getB2BTpRate(a));

    const nonSeniorAgents = agentsWithB2BData
      .filter(a => !seniorSet.has(a.agentName.toLowerCase()))
      .sort((a, b) => getB2BTpRate(b) - getB2BTpRate(a));

    return {
      seniorTop3: seniorAgents.slice(0, 3),
      seniorBottom3: seniorAgents.slice(-3).reverse(),
      nonSeniorTop3: nonSeniorAgents.slice(0, 3),
      nonSeniorBottom3: nonSeniorAgents.slice(-3).reverse(),
    };
  }, [b2bByAgent, seniorSet]);

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

      {/* ==================== CLIENT SEGMENTS SECTION ==================== */}
      {(repeatClientPerformance?.segments.length || b2bPerformance?.segments.length) && (
        <div className="space-y-4">
          <SectionHeader
            title="Client Segments"
            icon={<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>}
            iconColor="bg-cyan-500/20"
            section="clientSegments"
            subtitle="Repeat client and B2B conversion performance"
          />

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expandedSections.clientSegments ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-6 pl-2 border-l-2 border-cyan-500/20">
              {/* Repeat Client Performance */}
              {repeatClientPerformance && repeatClientPerformance.segments.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Repeat Client T&gt;P Performance
                    </h4>
                    {/* Timeframe Toggle */}
                    <div className="flex flex-wrap gap-1 bg-slate-800/50 p-1 rounded-lg">
                      {[
                        { value: 'lastWeek', label: 'Last Wk' },
                        { value: 'thisMonth', label: 'This Mo' },
                        { value: 'lastMonth', label: 'Last Mo' },
                        { value: 'thisQuarter', label: 'This Q' },
                        { value: 'lastQuarter', label: 'Last Q' },
                        { value: 'lastYear', label: 'Last Yr' },
                        { value: 'all', label: 'All' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setRepeatTimeframe(value as RegionalTimeframe)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            repeatTimeframe === value
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Department Level Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {repeatClientPerformance.segments.map((seg) => (
                      <div
                        key={seg.segment}
                        className={`rounded-lg p-4 border ${
                          seg.segment === 'Repeat'
                            ? 'bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border-emerald-500/30'
                            : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-slate-600/30'
                        }`}
                      >
                        <div className="text-xs text-slate-400 mb-1">{seg.segment} Clients</div>
                        <div className={`text-2xl font-bold ${seg.segment === 'Repeat' ? 'text-emerald-400' : 'text-white'}`}>
                          {seg.tpRate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {seg.passthroughs}/{seg.trips} trips
                        </div>
                      </div>
                    ))}
                    <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
                      <div className="text-xs text-slate-400 mb-1">Total</div>
                      <div className="text-2xl font-bold text-white">{repeatClientPerformance.totalTrips.toLocaleString()}</div>
                      <div className="text-xs text-slate-500 mt-1">trips analyzed</div>
                    </div>
                    {repeatClientPerformance.segments.length === 2 && (
                      <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
                        <div className="text-xs text-slate-400 mb-1">Difference</div>
                        <div className={`text-2xl font-bold ${
                          (repeatClientPerformance.segments[0]?.tpRate || 0) > (repeatClientPerformance.segments[1]?.tpRate || 0)
                            ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {repeatClientPerformance.segments[0] && repeatClientPerformance.segments[1]
                            ? `${((repeatClientPerformance.segments[0].tpRate - repeatClientPerformance.segments[1].tpRate) > 0 ? '+' : '')}${(repeatClientPerformance.segments[0].tpRate - repeatClientPerformance.segments[1].tpRate).toFixed(1)}pp`
                            : '—'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {repeatClientPerformance.segments[0]?.segment} vs {repeatClientPerformance.segments[1]?.segment}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agent Level Breakdown */}
                  {repeatClientByAgent.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <h5 className="text-xs font-medium text-slate-400 mb-3">Agent Performance by Client Type</h5>
                      <select
                        value={selectedAgentForRepeat}
                        onChange={(e) => setSelectedAgentForRepeat(e.target.value)}
                        className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white mb-3"
                      >
                        <option value="">Select agent...</option>
                        {repeatClientByAgent.map(a => (
                          <option key={a.agentName} value={a.agentName}>
                            {a.agentName} ({a.totalTrips} trips)
                          </option>
                        ))}
                      </select>

                      {selectedRepeatAgentData && (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedRepeatAgentData.segments.map(seg => (
                            <div
                              key={seg.segment}
                              className={`rounded-lg p-3 ${
                                seg.segment === 'Repeat' ? 'bg-emerald-900/30' : 'bg-slate-700/30'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-slate-300">{seg.segment}</span>
                                <span className={`text-lg font-bold ${seg.segment === 'Repeat' ? 'text-emerald-400' : 'text-white'}`}>
                                  {seg.tpRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {seg.passthroughs} passthroughs / {seg.trips} trips
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agent Rankings by Senior/Non-Senior for Repeat Clients */}
                  {(repeatAgentRankings.seniorTop3.length > 0 || repeatAgentRankings.nonSeniorTop3.length > 0) && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <h5 className="text-xs font-medium text-slate-400 mb-4">Agent Rankings - Repeat Client T&gt;P</h5>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Senior Agents */}
                        {repeatAgentRankings.seniorTop3.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs text-emerald-400 font-medium">Senior Agents</div>
                            {/* Top 3 */}
                            <div className="bg-emerald-900/20 rounded-lg p-3 border border-emerald-700/30">
                              <div className="text-xs text-emerald-300 mb-2">Top Performers</div>
                              <div className="space-y-1.5">
                                {repeatAgentRankings.seniorTop3.map((agent, i) => {
                                  const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
                                  return (
                                    <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-300 truncate max-w-[150px]">
                                        <span className="text-emerald-400 mr-1">{i + 1}.</span>
                                        {agent.agentName}
                                      </span>
                                      <span className="text-emerald-400 font-medium">{repeatSeg?.tpRate.toFixed(1)}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {/* Bottom 3 */}
                            {repeatAgentRankings.seniorBottom3.length > 0 && (
                              <div className="bg-rose-900/20 rounded-lg p-3 border border-rose-700/30">
                                <div className="text-xs text-rose-300 mb-2">Needs Improvement</div>
                                <div className="space-y-1.5">
                                  {repeatAgentRankings.seniorBottom3.map((agent) => {
                                    const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
                                    return (
                                      <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-300 truncate max-w-[150px]">{agent.agentName}</span>
                                        <span className="text-rose-400 font-medium">{repeatSeg?.tpRate.toFixed(1)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Non-Senior Agents */}
                        {repeatAgentRankings.nonSeniorTop3.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs text-slate-400 font-medium">Non-Senior Agents</div>
                            {/* Top 3 */}
                            <div className="bg-emerald-900/20 rounded-lg p-3 border border-emerald-700/30">
                              <div className="text-xs text-emerald-300 mb-2">Top Performers</div>
                              <div className="space-y-1.5">
                                {repeatAgentRankings.nonSeniorTop3.map((agent, i) => {
                                  const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
                                  return (
                                    <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-300 truncate max-w-[150px]">
                                        <span className="text-emerald-400 mr-1">{i + 1}.</span>
                                        {agent.agentName}
                                      </span>
                                      <span className="text-emerald-400 font-medium">{repeatSeg?.tpRate.toFixed(1)}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {/* Bottom 3 */}
                            {repeatAgentRankings.nonSeniorBottom3.length > 0 && (
                              <div className="bg-rose-900/20 rounded-lg p-3 border border-rose-700/30">
                                <div className="text-xs text-rose-300 mb-2">Needs Improvement</div>
                                <div className="space-y-1.5">
                                  {repeatAgentRankings.nonSeniorBottom3.map((agent) => {
                                    const repeatSeg = agent.segments.find(s => s.segment === 'Repeat');
                                    return (
                                      <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-300 truncate max-w-[150px]">{agent.agentName}</span>
                                        <span className="text-rose-400 font-medium">{repeatSeg?.tpRate.toFixed(1)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* B2B Performance */}
              {b2bPerformance && b2bPerformance.segments.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      B2B vs B2C T&gt;P Performance
                    </h4>
                    {/* Timeframe Toggle */}
                    <div className="flex flex-wrap gap-1 bg-slate-800/50 p-1 rounded-lg">
                      {[
                        { value: 'lastWeek', label: 'Last Wk' },
                        { value: 'thisMonth', label: 'This Mo' },
                        { value: 'lastMonth', label: 'Last Mo' },
                        { value: 'thisQuarter', label: 'This Q' },
                        { value: 'lastQuarter', label: 'Last Q' },
                        { value: 'lastYear', label: 'Last Yr' },
                        { value: 'all', label: 'All' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setB2bTimeframe(value as RegionalTimeframe)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            b2bTimeframe === value
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Department Level Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {b2bPerformance.segments.map((seg) => (
                      <div
                        key={seg.segment}
                        className={`rounded-lg p-4 border ${
                          seg.segment === 'B2B'
                            ? 'bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-blue-500/30'
                            : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-slate-600/30'
                        }`}
                      >
                        <div className="text-xs text-slate-400 mb-1">{seg.segment}</div>
                        <div className={`text-2xl font-bold ${seg.segment === 'B2B' ? 'text-blue-400' : 'text-white'}`}>
                          {seg.tpRate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {seg.passthroughs}/{seg.trips} trips
                        </div>
                      </div>
                    ))}
                    <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
                      <div className="text-xs text-slate-400 mb-1">Total</div>
                      <div className="text-2xl font-bold text-white">{b2bPerformance.totalTrips.toLocaleString()}</div>
                      <div className="text-xs text-slate-500 mt-1">trips analyzed</div>
                    </div>
                    {b2bPerformance.segments.length === 2 && (
                      <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
                        <div className="text-xs text-slate-400 mb-1">Difference</div>
                        <div className={`text-2xl font-bold ${
                          (b2bPerformance.segments[0]?.tpRate || 0) > (b2bPerformance.segments[1]?.tpRate || 0)
                            ? 'text-blue-400' : 'text-rose-400'
                        }`}>
                          {b2bPerformance.segments[0] && b2bPerformance.segments[1]
                            ? `${((b2bPerformance.segments[0].tpRate - b2bPerformance.segments[1].tpRate) > 0 ? '+' : '')}${(b2bPerformance.segments[0].tpRate - b2bPerformance.segments[1].tpRate).toFixed(1)}pp`
                            : '—'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {b2bPerformance.segments[0]?.segment} vs {b2bPerformance.segments[1]?.segment}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agent Level Breakdown */}
                  {b2bByAgent.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <h5 className="text-xs font-medium text-slate-400 mb-3">Agent Performance by Business Type</h5>
                      <select
                        value={selectedAgentForB2B}
                        onChange={(e) => setSelectedAgentForB2B(e.target.value)}
                        className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white mb-3"
                      >
                        <option value="">Select agent...</option>
                        {b2bByAgent.map(a => (
                          <option key={a.agentName} value={a.agentName}>
                            {a.agentName} ({a.totalTrips} trips)
                          </option>
                        ))}
                      </select>

                      {selectedB2BAgentData && (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedB2BAgentData.segments.map(seg => (
                            <div
                              key={seg.segment}
                              className={`rounded-lg p-3 ${
                                seg.segment === 'B2B' ? 'bg-blue-900/30' : 'bg-slate-700/30'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-slate-300">{seg.segment}</span>
                                <span className={`text-lg font-bold ${seg.segment === 'B2B' ? 'text-blue-400' : 'text-white'}`}>
                                  {seg.tpRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {seg.passthroughs} passthroughs / {seg.trips} trips
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agent Rankings by Senior/Non-Senior for B2B */}
                  {(b2bAgentRankings.seniorTop3.length > 0 || b2bAgentRankings.nonSeniorTop3.length > 0) && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <h5 className="text-xs font-medium text-slate-400 mb-4">Agent Rankings - B2B T&gt;P</h5>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Senior Agents */}
                        {b2bAgentRankings.seniorTop3.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs text-blue-400 font-medium">Senior Agents</div>
                            {/* Top 3 */}
                            <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-700/30">
                              <div className="text-xs text-blue-300 mb-2">Top Performers</div>
                              <div className="space-y-1.5">
                                {b2bAgentRankings.seniorTop3.map((agent, i) => {
                                  const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
                                  return (
                                    <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-300 truncate max-w-[150px]">
                                        <span className="text-blue-400 mr-1">{i + 1}.</span>
                                        {agent.agentName}
                                      </span>
                                      <span className="text-blue-400 font-medium">{b2bSeg?.tpRate.toFixed(1)}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {/* Bottom 3 */}
                            {b2bAgentRankings.seniorBottom3.length > 0 && (
                              <div className="bg-rose-900/20 rounded-lg p-3 border border-rose-700/30">
                                <div className="text-xs text-rose-300 mb-2">Needs Improvement</div>
                                <div className="space-y-1.5">
                                  {b2bAgentRankings.seniorBottom3.map((agent) => {
                                    const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
                                    return (
                                      <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-300 truncate max-w-[150px]">{agent.agentName}</span>
                                        <span className="text-rose-400 font-medium">{b2bSeg?.tpRate.toFixed(1)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Non-Senior Agents */}
                        {b2bAgentRankings.nonSeniorTop3.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs text-slate-400 font-medium">Non-Senior Agents</div>
                            {/* Top 3 */}
                            <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-700/30">
                              <div className="text-xs text-blue-300 mb-2">Top Performers</div>
                              <div className="space-y-1.5">
                                {b2bAgentRankings.nonSeniorTop3.map((agent, i) => {
                                  const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
                                  return (
                                    <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-300 truncate max-w-[150px]">
                                        <span className="text-blue-400 mr-1">{i + 1}.</span>
                                        {agent.agentName}
                                      </span>
                                      <span className="text-blue-400 font-medium">{b2bSeg?.tpRate.toFixed(1)}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {/* Bottom 3 */}
                            {b2bAgentRankings.nonSeniorBottom3.length > 0 && (
                              <div className="bg-rose-900/20 rounded-lg p-3 border border-rose-700/30">
                                <div className="text-xs text-rose-300 mb-2">Needs Improvement</div>
                                <div className="space-y-1.5">
                                  {b2bAgentRankings.nonSeniorBottom3.map((agent) => {
                                    const b2bSeg = agent.segments.find(s => s.segment === 'B2B');
                                    return (
                                      <div key={agent.agentName} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-300 truncate max-w-[150px]">{agent.agentName}</span>
                                        <span className="text-rose-400 font-medium">{b2bSeg?.tpRate.toFixed(1)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

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
