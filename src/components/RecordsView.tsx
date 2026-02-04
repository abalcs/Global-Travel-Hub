import { useState, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { AllRecords, AgentRecords, VolumeMetric, RateMetric, TimePeriod, RecordEntry } from '../utils/recordsTracker';
import { formatMetricName, formatPeriodName, formatRecordValue, formatDateRange, clearRecords } from '../utils/recordsTracker';
import type { Team } from '../types';

interface RecordsViewProps {
  records: AllRecords;
  teams: Team[];
  onClearRecords: () => void;
}

// Helper to check if a record should be shown in Recent Records
// Logic: Show starting the day after the period ends, for 7 days total
// Example: Daily record for Jan 1 shows Jan 2-8, removed on Jan 9
const shouldShowRecentRecord = (periodEnd: string): boolean => {
  const periodEndDate = new Date(periodEnd);
  const now = new Date();

  // Reset time components for accurate day comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodEndDay = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), periodEndDate.getDate());

  // The period must be complete (we're past the period end date)
  if (todayStart <= periodEndDay) {
    return false;
  }

  // Calculate days since period ended
  const daysSincePeriodEnd = Math.floor((todayStart.getTime() - periodEndDay.getTime()) / (1000 * 60 * 60 * 24));

  // Show for 7 days after the period ends (days 1-7 after period end)
  return daysSincePeriodEnd <= 7;
};

type ViewMode = 'volume' | 'rates';
type SortBy = 'name' | 'trips' | 'quotes' | 'passthroughs' | 'tq' | 'tp' | 'pq';

const VOLUME_METRICS: VolumeMetric[] = ['trips', 'quotes', 'passthroughs'];
const RATE_METRICS: RateMetric[] = ['tq', 'tp', 'pq'];
const VOLUME_PERIODS: TimePeriod[] = ['day', 'week', 'month', 'quarter'];
const RATE_PERIODS: TimePeriod[] = ['month', 'quarter'];

export const RecordsView: React.FC<RecordsViewProps> = ({ records, teams, onClearRecords }) => {
  const { isAudley } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('volume');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showAllRecentRecords, setShowAllRecentRecords] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);

  // Get agents for the selected team filter
  const teamAgentNames = useMemo(() => {
    if (!selectedTeamFilter) return null;
    const team = teams.find(t => t.id === selectedTeamFilter);
    return team ? new Set(team.agentNames) : null;
  }, [selectedTeamFilter, teams]);

  const agents = useMemo(() => {
    return Object.values(records.agents).sort((a, b) => {
      if (sortBy === 'name') {
        return sortDir === 'asc'
          ? a.agentName.localeCompare(b.agentName)
          : b.agentName.localeCompare(a.agentName);
      }

      const aRecord = a[sortBy as keyof AgentRecords];
      const bRecord = b[sortBy as keyof AgentRecords];

      if (!aRecord || !bRecord || typeof aRecord === 'string' || typeof bRecord === 'string') {
        return 0;
      }

      const period = VOLUME_METRICS.includes(sortBy as VolumeMetric) ? selectedPeriod :
                     (selectedPeriod === 'week' ? 'month' : selectedPeriod);

      const aVal = (aRecord as Record<TimePeriod, { value: number } | null>)[period]?.value || 0;
      const bVal = (bRecord as Record<TimePeriod, { value: number } | null>)[period]?.value || 0;

      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [records.agents, sortBy, sortDir, selectedPeriod]);

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  const selectedAgentRecords = selectedAgent ? records.agents[selectedAgent] : null;

  // Get recent records based on visibility rules:
  // All records show starting the day after their period ends, for 7 days
  // Example: Daily record for Jan 1 shows Jan 2-8, removed on Jan 9
  const recentRecords = useMemo(() => {
    const allRecords: Array<{
      agentName: string;
      metric: VolumeMetric | RateMetric;
      period: TimePeriod;
      record: RecordEntry;
    }> = [];

    for (const agent of Object.values(records.agents)) {
      // Filter by team if selected
      if (teamAgentNames && !teamAgentNames.has(agent.agentName)) {
        continue;
      }

      // Check volume metrics
      for (const metric of VOLUME_METRICS) {
        for (const period of VOLUME_PERIODS) {
          const record = agent[metric][period];
          if (record && shouldShowRecentRecord(record.periodEnd)) {
            allRecords.push({ agentName: agent.agentName, metric, period, record });
          }
        }
      }
      // Check rate metrics
      for (const metric of RATE_METRICS) {
        for (const period of RATE_PERIODS) {
          const record = agent[metric][period as 'month' | 'quarter'];
          if (record && shouldShowRecentRecord(record.periodEnd)) {
            allRecords.push({ agentName: agent.agentName, metric, period, record });
          }
        }
      }
    }

    // Sort by periodEnd date descending (most recent periods first)
    return allRecords.sort((a, b) =>
      new Date(b.record.periodEnd).getTime() - new Date(a.record.periodEnd).getTime()
    );
  }, [records.agents, teamAgentNames]);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all records? This cannot be undone.')) {
      clearRecords();
      onClearRecords();
    }
  };

  const getMetricColor = (metric: VolumeMetric | RateMetric): string => {
    const colors: Record<string, string> = {
      trips: 'text-blue-400',
      quotes: 'text-green-400',
      passthroughs: 'text-purple-400',
      tq: 'text-emerald-400',
      tp: 'text-cyan-400',
      pq: 'text-pink-400',
    };
    return colors[metric] || 'text-white';
  };

  const getMetricBgColor = (metric: VolumeMetric | RateMetric): string => {
    const colors: Record<string, string> = {
      trips: 'bg-blue-500/20 border-blue-500/30',
      quotes: 'bg-green-500/20 border-green-500/30',
      passthroughs: 'bg-purple-500/20 border-purple-500/30',
      tq: 'bg-emerald-500/20 border-emerald-500/30',
      tp: 'bg-cyan-500/20 border-cyan-500/30',
      pq: 'bg-pink-500/20 border-pink-500/30',
    };
    return colors[metric] || 'bg-slate-500/20 border-slate-500/30';
  };

  if (Object.keys(records.agents).length === 0) {
    return (
      <div className="text-center py-16">
        <svg className={`w-16 h-16 mx-auto mb-4 ${isAudley ? 'text-[#4d726d]/40' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
        <h2 className={`text-xl font-semibold mb-2 ${isAudley ? 'text-[#4d726d]' : 'text-white'}`}>No Records Yet</h2>
        <p className={`max-w-md mx-auto ${isAudley ? 'text-slate-600' : 'text-slate-400'}`}>
          Personal records will be tracked once you analyze data. Records are saved automatically and persist across sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold flex items-center gap-2 ${isAudley ? 'text-[#4d726d]' : 'text-white'}`}>
            <svg className={`w-6 h-6 ${isAudley ? 'text-amber-500' : 'text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Personal Records
          </h2>
          <p className={`text-sm mt-1 ${isAudley ? 'text-slate-600' : 'text-slate-400'}`}>
            Track best performances by agent across different time periods
          </p>
        </div>
        <button
          onClick={handleClear}
          className={`text-xs transition-colors ${isAudley ? 'text-slate-500 hover:text-red-600' : 'text-slate-500 hover:text-red-400'}`}
        >
          Clear All Records
        </button>
      </div>

      {/* Recent Records Section */}
      {recentRecords.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${
          isAudley
            ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300'
            : 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b ${isAudley ? 'border-amber-200' : 'border-yellow-500/20'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 ${isAudley ? 'text-amber-500' : 'text-yellow-400'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                </svg>
                <h3 className={`text-lg font-semibold ${isAudley ? 'text-amber-600' : 'text-yellow-400'}`}>
                  Recent Records
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isAudley ? 'bg-amber-100 text-amber-600' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {recentRecords.length} records
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Team Filter Toggle */}
                {teams.length > 0 && (
                  <div className={`flex items-center gap-1 rounded-lg p-0.5 ${
                    isAudley ? 'bg-amber-100/50' : 'bg-slate-800/50'
                  }`}>
                    <button
                      onClick={() => setSelectedTeamFilter(null)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        selectedTeamFilter === null
                          ? isAudley ? 'bg-amber-500 text-white' : 'bg-yellow-500 text-slate-900'
                          : isAudley ? 'text-amber-700 hover:bg-amber-100' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      All
                    </button>
                    {teams.map(team => (
                      <button
                        key={team.id}
                        onClick={() => setSelectedTeamFilter(team.id)}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                          selectedTeamFilter === team.id
                            ? isAudley ? 'bg-amber-500 text-white' : 'bg-yellow-500 text-slate-900'
                            : isAudley ? 'text-amber-700 hover:bg-amber-100' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                )}
                {/* Screenshot View button */}
                <button
                  onClick={() => setShowScreenshotModal(true)}
                  className={`text-xs transition-colors flex items-center gap-1 cursor-pointer px-2 py-1 rounded ${
                    isAudley
                      ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-100'
                      : 'text-yellow-400 hover:text-yellow-300 hover:bg-slate-700/50'
                  }`}
                  title="Open screenshot-friendly view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Screenshot
                </button>
                {/* Expand/Collapse toggle */}
                <button
                  onClick={() => setShowAllRecentRecords(!showAllRecentRecords)}
                  className={`text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                    isAudley ? 'text-amber-600 hover:text-amber-700' : 'text-yellow-400 hover:text-yellow-300'
                  }`}
                >
                  {showAllRecentRecords ? 'Collapse' : 'View All'}
                  <svg
                    className={`w-4 h-4 transition-transform ${showAllRecentRecords ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Records Display */}
          {!showAllRecentRecords ? (
            /* Compact grid view - show first 9 */
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentRecords.slice(0, 9).map((item, idx) => (
                  <div
                    key={`${item.agentName}-${item.metric}-${item.period}-${idx}`}
                    className={`rounded-lg p-3 flex items-center gap-3 ${
                      isAudley ? 'bg-white shadow-sm' : 'bg-slate-800/50'
                    }`}
                  >
                    <div className={`rounded-full p-2 ${isAudley ? 'bg-amber-100' : 'bg-yellow-500/20'}`}>
                      <svg className={`w-5 h-5 ${isAudley ? 'text-amber-500' : 'text-yellow-400'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${isAudley ? 'text-[#313131]' : 'text-white'}`}>{item.agentName}</div>
                      <div className={`text-xs ${isAudley ? 'text-slate-500' : 'text-slate-400'}`}>
                        {formatPeriodName(item.period)} {formatMetricName(item.metric)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getMetricColor(item.metric)}`}>
                        {formatRecordValue(item.metric, item.record.value)}
                      </div>
                      <div className={`text-xs ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formatDateRange(item.record.periodStart, item.record.periodEnd)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {recentRecords.length > 9 && (
                <button
                  onClick={() => setShowAllRecentRecords(true)}
                  className={`mt-3 w-full py-2 text-center text-sm rounded-lg transition-colors ${
                    isAudley
                      ? 'text-amber-600 hover:text-amber-700 bg-white hover:bg-amber-50'
                      : 'text-yellow-400 hover:text-yellow-300 bg-slate-800/30 hover:bg-slate-800/50'
                  }`}
                >
                  View all {recentRecords.length} records
                </button>
              )}
            </div>
          ) : (
            /* Expanded table view - show all records */
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className={`sticky top-0 ${isAudley ? 'bg-amber-50' : 'bg-slate-900/50'}`}>
                  <tr>
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase ${isAudley ? 'text-amber-700' : 'text-slate-400'}`}>Agent</th>
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase ${isAudley ? 'text-amber-700' : 'text-slate-400'}`}>Metric</th>
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase ${isAudley ? 'text-amber-700' : 'text-slate-400'}`}>Period</th>
                    <th className={`px-4 py-2 text-right text-xs font-semibold uppercase ${isAudley ? 'text-amber-700' : 'text-slate-400'}`}>Value</th>
                    <th className={`px-4 py-2 text-right text-xs font-semibold uppercase ${isAudley ? 'text-amber-700' : 'text-slate-400'}`}>Date Range</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isAudley ? 'divide-amber-200/50' : 'divide-slate-700/30'}`}>
                  {recentRecords.map((item, idx) => (
                    <tr
                      key={`${item.agentName}-${item.metric}-${item.period}-${idx}`}
                      className={idx % 2 === 0 ? (isAudley ? 'bg-white/50' : 'bg-slate-800/20') : (isAudley ? 'bg-amber-50/50' : 'bg-slate-800/40')}
                    >
                      <td className={`px-4 py-2 text-sm font-medium ${isAudley ? 'text-[#313131]' : 'text-white'}`}>{item.agentName}</td>
                      <td className={`px-4 py-2 text-sm ${getMetricColor(item.metric)}`}>
                        {formatMetricName(item.metric)}
                      </td>
                      <td className={`px-4 py-2 text-sm ${isAudley ? 'text-slate-600' : 'text-slate-400'}`}>{formatPeriodName(item.period)}</td>
                      <td className={`px-4 py-2 text-sm text-right font-bold ${getMetricColor(item.metric)}`}>
                        {formatRecordValue(item.metric, item.record.value)}
                      </td>
                      <td className={`px-4 py-2 text-sm text-right ${isAudley ? 'text-slate-500' : 'text-slate-400'}`}>
                        {formatDateRange(item.record.periodStart, item.record.periodEnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* View Toggle & Period Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <div className={`rounded-lg p-1 flex gap-1 ${
          isAudley ? 'bg-white border border-[#4d726d]/20 shadow-sm' : 'bg-slate-800/50'
        }`}>
          <button
            onClick={() => setViewMode('volume')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'volume'
                ? isAudley ? 'bg-[#007bc7] text-white' : 'bg-indigo-600 text-white'
                : isAudley ? 'text-[#4d726d] hover:bg-[#e8f0ef]' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Volume Records
          </button>
          <button
            onClick={() => setViewMode('rates')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'rates'
                ? isAudley ? 'bg-[#007bc7] text-white' : 'bg-indigo-600 text-white'
                : isAudley ? 'text-[#4d726d] hover:bg-[#e8f0ef]' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Rate Records
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-sm ${isAudley ? 'text-slate-600' : 'text-slate-400'}`}>Period:</span>
          <div className={`rounded-lg p-1 flex gap-1 ${
            isAudley ? 'bg-white border border-[#4d726d]/20 shadow-sm' : 'bg-slate-800/50'
          }`}>
            {(viewMode === 'volume' ? VOLUME_PERIODS : RATE_PERIODS).map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedPeriod === period
                    ? isAudley ? 'bg-amber-500 text-white' : 'bg-yellow-500 text-slate-900'
                    : isAudley ? 'text-[#4d726d] hover:bg-[#e8f0ef]' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {formatPeriodName(period)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className={`rounded-xl border overflow-hidden ${
        isAudley ? 'bg-white border-[#4d726d]/20 shadow-sm' : 'bg-slate-800/50 border-slate-700/50'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isAudley ? 'bg-[#f8fafc]' : 'bg-slate-900/50'}>
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer ${
                    isAudley ? 'text-[#4d726d] hover:bg-[#e8f0ef]/50' : 'text-slate-400 hover:bg-slate-700/30'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    Agent
                    {sortBy === 'name' && (
                      <span className={isAudley ? 'text-amber-500' : 'text-yellow-400'}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                {(viewMode === 'volume' ? VOLUME_METRICS : RATE_METRICS).map(metric => (
                  <th
                    key={metric}
                    onClick={() => handleSort(metric as SortBy)}
                    className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer ${
                      isAudley ? 'hover:bg-[#e8f0ef]/50' : 'hover:bg-slate-700/30'
                    }`}
                  >
                    <div className={`flex items-center justify-center gap-1 ${getMetricColor(metric)}`}>
                      {formatMetricName(metric)}
                      {sortBy === metric && (
                        <span className={isAudley ? 'text-amber-500' : 'text-yellow-400'}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                ))}
                <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${
                  isAudley ? 'text-[#4d726d]' : 'text-slate-400'
                }`}>
                  Details
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isAudley ? 'divide-[#4d726d]/10' : 'divide-slate-700/50'}`}>
              {agents.map((agent, idx) => {
                const metrics = viewMode === 'volume' ? VOLUME_METRICS : RATE_METRICS;
                const period = viewMode === 'volume' ? selectedPeriod :
                               (selectedPeriod === 'week' ? 'month' : selectedPeriod);

                return (
                  <tr key={agent.agentName} className={idx % 2 === 0 ? (isAudley ? 'bg-[#f8fafc]/50' : 'bg-slate-800/30') : ''}>
                    <td className={`px-4 py-3 text-sm font-medium ${isAudley ? 'text-[#313131]' : 'text-white'}`}>
                      {agent.agentName}
                    </td>
                    {metrics.map(metric => {
                      const record = (agent[metric] as Record<TimePeriod, { value: number; periodStart: string; periodEnd: string } | null>)[period];
                      return (
                        <td key={metric} className="px-4 py-3 text-center">
                          {record ? (
                            <div>
                              <div className={`text-sm font-bold ${getMetricColor(metric)}`}>
                                {formatRecordValue(metric, record.value)}
                              </div>
                              <div className={`text-xs ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                                {formatDateRange(record.periodStart, record.periodEnd)}
                              </div>
                            </div>
                          ) : (
                            <span className={isAudley ? 'text-slate-300' : 'text-slate-600'}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedAgent(selectedAgent === agent.agentName ? null : agent.agentName)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          selectedAgent === agent.agentName
                            ? isAudley ? 'bg-amber-500 text-white' : 'bg-yellow-500 text-slate-900'
                            : isAudley ? 'text-[#4d726d] hover:bg-[#e8f0ef] hover:text-[#313131]' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {selectedAgent === agent.agentName ? 'Hide' : 'View All'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Detail Panel */}
      {selectedAgentRecords && (
        <div className={`rounded-xl border p-6 ${
          isAudley ? 'bg-white border-[#4d726d]/20 shadow-sm' : 'bg-slate-800/50 border-slate-700/50'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isAudley ? 'text-[#4d726d]' : 'text-white'}`}>
            <svg className={`w-5 h-5 ${isAudley ? 'text-amber-500' : 'text-yellow-400'}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
            {selectedAgentRecords.agentName}'s Complete Records
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Volume Records */}
            <div>
              <h4 className={`text-sm font-medium mb-3 ${isAudley ? 'text-[#4d726d]' : 'text-slate-300'}`}>Volume Records</h4>
              <div className="space-y-3">
                {VOLUME_METRICS.map(metric => (
                  <div key={metric} className={`rounded-lg border p-3 ${getMetricBgColor(metric)}`}>
                    <div className={`text-sm font-semibold mb-2 ${getMetricColor(metric)}`}>
                      {formatMetricName(metric)}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {VOLUME_PERIODS.map(period => {
                        const record = selectedAgentRecords[metric][period];
                        return (
                          <div key={period} className="text-center">
                            <div className={`mb-1 ${isAudley ? 'text-slate-500' : 'text-slate-400'}`}>{formatPeriodName(period)}</div>
                            {record ? (
                              <>
                                <div className={`font-bold ${isAudley ? 'text-[#313131]' : 'text-white'}`}>
                                  {formatRecordValue(metric, record.value)}
                                </div>
                                <div className={`text-[10px] ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {formatDateRange(record.periodStart, record.periodEnd)}
                                </div>
                              </>
                            ) : (
                              <div className={isAudley ? 'text-slate-300' : 'text-slate-600'}>—</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rate Records */}
            <div>
              <h4 className={`text-sm font-medium mb-3 ${isAudley ? 'text-[#4d726d]' : 'text-slate-300'}`}>Rate Records</h4>
              <div className="space-y-3">
                {RATE_METRICS.map(metric => (
                  <div key={metric} className={`rounded-lg border p-3 ${getMetricBgColor(metric)}`}>
                    <div className={`text-sm font-semibold mb-2 ${getMetricColor(metric)}`}>
                      {formatMetricName(metric)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {RATE_PERIODS.map(period => {
                        const record = selectedAgentRecords[metric][period as 'month' | 'quarter'];
                        return (
                          <div key={period} className="text-center">
                            <div className={`mb-1 ${isAudley ? 'text-slate-500' : 'text-slate-400'}`}>{formatPeriodName(period)}</div>
                            {record ? (
                              <>
                                <div className={`font-bold ${isAudley ? 'text-[#313131]' : 'text-white'}`}>
                                  {formatRecordValue(metric, record.value)}
                                </div>
                                <div className={`text-[10px] ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {formatDateRange(record.periodStart, record.periodEnd)}
                                </div>
                              </>
                            ) : (
                              <div className={isAudley ? 'text-slate-300' : 'text-slate-600'}>—</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-500">
        Last updated: {new Date(records.lastUpdated).toLocaleString()}
      </div>

      {/* Screenshot Modal */}
      {showScreenshotModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-6xl my-4 rounded-xl shadow-2xl ${
            isAudley ? 'bg-white' : 'bg-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b rounded-t-xl ${
              isAudley ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200' : 'bg-slate-800 border-slate-700'
            }`}>
              <div className="flex items-center gap-3">
                <svg className={`w-6 h-6 ${isAudley ? 'text-amber-500' : 'text-yellow-400'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                </svg>
                <div>
                  <h2 className={`text-lg font-bold ${isAudley ? 'text-amber-700' : 'text-yellow-400'}`}>
                    Recent Records {selectedTeamFilter ? `- ${teams.find(t => t.id === selectedTeamFilter)?.name}` : ''}
                  </h2>
                  <p className={`text-xs ${isAudley ? 'text-amber-600' : 'text-slate-400'}`}>
                    {recentRecords.length} records • Screenshot-friendly view
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScreenshotModal(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isAudley ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Compact Grid */}
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {recentRecords.map((item, idx) => (
                  <div
                    key={`screenshot-${item.agentName}-${item.metric}-${item.period}-${idx}`}
                    className={`rounded-lg p-2 ${
                      isAudley ? 'bg-amber-50 border border-amber-200' : 'bg-slate-800 border border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`flex-shrink-0 rounded-full p-1 ${isAudley ? 'bg-amber-100' : 'bg-yellow-500/20'}`}>
                        <svg className={`w-3 h-3 ${isAudley ? 'text-amber-500' : 'text-yellow-400'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold truncate ${isAudley ? 'text-[#313131]' : 'text-white'}`}>
                          {item.agentName}
                        </div>
                        <div className={`text-[10px] ${isAudley ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatPeriodName(item.period)} {formatMetricName(item.metric)}
                        </div>
                        <div className={`text-sm font-bold ${getMetricColor(item.metric)}`}>
                          {formatRecordValue(item.metric, item.record.value)}
                        </div>
                        <div className={`text-[9px] ${isAudley ? 'text-slate-400' : 'text-slate-500'}`}>
                          {formatDateRange(item.record.periodStart, item.record.periodEnd)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`p-3 border-t text-center text-xs ${
              isAudley ? 'border-amber-200 text-amber-600 bg-amber-50/50' : 'border-slate-700 text-slate-500 bg-slate-800/50'
            }`}>
              Global Travel Hub • Records as of {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
