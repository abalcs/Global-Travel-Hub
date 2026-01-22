import { useState, useMemo } from 'react';
import type { AllRecords, AgentRecords, VolumeMetric, RateMetric, TimePeriod, RecordEntry } from '../utils/recordsTracker';
import { formatMetricName, formatPeriodName, formatRecordValue, formatDateRange, clearRecords } from '../utils/recordsTracker';

interface RecordsViewProps {
  records: AllRecords;
  onClearRecords: () => void;
}

// Helper to check if a date is in the current calendar quarter
const isCurrentQuarter = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const currentYear = now.getFullYear();
  const recordQuarter = Math.floor(date.getMonth() / 3);
  const recordYear = date.getFullYear();
  return currentQuarter === recordQuarter && currentYear === recordYear;
};

// Helper to check if a date is in the current calendar month
const isCurrentMonth = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

// Get current quarter label
const getCurrentQuarterLabel = (): string => {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Q${quarter} ${now.getFullYear()}`;
};

// Get current month label
const getCurrentMonthLabel = (): string => {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

type RecentRecordsFilter = 'quarter' | 'month';

type ViewMode = 'volume' | 'rates';
type SortBy = 'name' | 'trips' | 'quotes' | 'passthroughs' | 'tq' | 'tp' | 'pq';

const VOLUME_METRICS: VolumeMetric[] = ['trips', 'quotes', 'passthroughs'];
const RATE_METRICS: RateMetric[] = ['tq', 'tp', 'pq'];
const VOLUME_PERIODS: TimePeriod[] = ['day', 'week', 'month', 'quarter'];
const RATE_PERIODS: TimePeriod[] = ['month', 'quarter'];

export const RecordsView: React.FC<RecordsViewProps> = ({ records, onClearRecords }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('volume');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [recentRecordsFilter, setRecentRecordsFilter] = useState<RecentRecordsFilter>('quarter');
  const [showAllRecentRecords, setShowAllRecentRecords] = useState(false);

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

  // Get all records set in the current quarter or month
  const recentRecords = useMemo(() => {
    const filterFn = recentRecordsFilter === 'quarter' ? isCurrentQuarter : isCurrentMonth;
    const allRecords: Array<{
      agentName: string;
      metric: VolumeMetric | RateMetric;
      period: TimePeriod;
      record: RecordEntry;
    }> = [];

    for (const agent of Object.values(records.agents)) {
      // Check volume metrics
      for (const metric of VOLUME_METRICS) {
        for (const period of VOLUME_PERIODS) {
          const record = agent[metric][period];
          if (record && filterFn(record.setAt)) {
            allRecords.push({ agentName: agent.agentName, metric, period, record });
          }
        }
      }
      // Check rate metrics
      for (const metric of RATE_METRICS) {
        for (const period of RATE_PERIODS) {
          const record = agent[metric][period as 'month' | 'quarter'];
          if (record && filterFn(record.setAt)) {
            allRecords.push({ agentName: agent.agentName, metric, period, record });
          }
        }
      }
    }

    // Sort by setAt date descending (most recent first)
    return allRecords.sort((a, b) =>
      new Date(b.record.setAt).getTime() - new Date(a.record.setAt).getTime()
    );
  }, [records.agents, recentRecordsFilter]);

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
        <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">No Records Yet</h2>
        <p className="text-slate-400 max-w-md mx-auto">
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
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Personal Records
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Track best performances by agent across different time periods
          </p>
        </div>
        <button
          onClick={handleClear}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          Clear All Records
        </button>
      </div>

      {/* Recent Records Section */}
      {recentRecords.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-xl border border-yellow-500/30 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-yellow-500/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                </svg>
                <h3 className="text-lg font-semibold text-yellow-400">
                  Records Set This {recentRecordsFilter === 'quarter' ? 'Quarter' : 'Month'}
                </h3>
                <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs font-medium">
                  {recentRecords.length} records
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Toggle between Quarter and Month */}
                <div className="bg-slate-800/50 rounded-lg p-1 flex gap-1">
                  <button
                    onClick={() => setRecentRecordsFilter('month')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      recentRecordsFilter === 'month'
                        ? 'bg-yellow-500 text-slate-900'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    {getCurrentMonthLabel()}
                  </button>
                  <button
                    onClick={() => setRecentRecordsFilter('quarter')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      recentRecordsFilter === 'quarter'
                        ? 'bg-yellow-500 text-slate-900'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    {getCurrentQuarterLabel()}
                  </button>
                </div>
                {/* Expand/Collapse toggle */}
                <button
                  onClick={() => setShowAllRecentRecords(!showAllRecentRecords)}
                  className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors flex items-center gap-1"
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
                    className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3"
                  >
                    <div className="bg-yellow-500/20 rounded-full p-2">
                      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{item.agentName}</div>
                      <div className="text-xs text-slate-400">
                        {formatPeriodName(item.period)} {formatMetricName(item.metric)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getMetricColor(item.metric)}`}>
                        {formatRecordValue(item.metric, item.record.value)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateRange(item.record.periodStart, item.record.periodEnd)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {recentRecords.length > 9 && (
                <button
                  onClick={() => setShowAllRecentRecords(true)}
                  className="mt-3 w-full py-2 text-center text-sm text-yellow-400 hover:text-yellow-300 bg-slate-800/30 hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  View all {recentRecords.length} records
                </button>
              )}
            </div>
          ) : (
            /* Expanded table view - show all records */
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Agent</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Metric</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Period</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400 uppercase">Value</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400 uppercase">Date Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {recentRecords.map((item, idx) => (
                    <tr
                      key={`${item.agentName}-${item.metric}-${item.period}-${idx}`}
                      className={idx % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/40'}
                    >
                      <td className="px-4 py-2 text-sm text-white font-medium">{item.agentName}</td>
                      <td className={`px-4 py-2 text-sm ${getMetricColor(item.metric)}`}>
                        {formatMetricName(item.metric)}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-400">{formatPeriodName(item.period)}</td>
                      <td className={`px-4 py-2 text-sm text-right font-bold ${getMetricColor(item.metric)}`}>
                        {formatRecordValue(item.metric, item.record.value)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-slate-400">
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
        <div className="bg-slate-800/50 rounded-lg p-1 flex gap-1">
          <button
            onClick={() => setViewMode('volume')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'volume'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Volume Records
          </button>
          <button
            onClick={() => setViewMode('rates')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'rates'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Rate Records
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Period:</span>
          <div className="bg-slate-800/50 rounded-lg p-1 flex gap-1">
            {(viewMode === 'volume' ? VOLUME_PERIODS : RATE_PERIODS).map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-yellow-500 text-slate-900'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {formatPeriodName(period)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/30"
                >
                  <div className="flex items-center gap-1">
                    Agent
                    {sortBy === 'name' && (
                      <span className="text-yellow-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                {(viewMode === 'volume' ? VOLUME_METRICS : RATE_METRICS).map(metric => (
                  <th
                    key={metric}
                    onClick={() => handleSort(metric as SortBy)}
                    className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-700/30"
                  >
                    <div className={`flex items-center justify-center gap-1 ${getMetricColor(metric)}`}>
                      {formatMetricName(metric)}
                      {sortBy === metric && (
                        <span className="text-yellow-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {agents.map((agent, idx) => {
                const metrics = viewMode === 'volume' ? VOLUME_METRICS : RATE_METRICS;
                const period = viewMode === 'volume' ? selectedPeriod :
                               (selectedPeriod === 'week' ? 'month' : selectedPeriod);

                return (
                  <tr key={agent.agentName} className={idx % 2 === 0 ? 'bg-slate-800/30' : ''}>
                    <td className="px-4 py-3 text-sm font-medium text-white">
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
                              <div className="text-xs text-slate-500">
                                {formatDateRange(record.periodStart, record.periodEnd)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedAgent(selectedAgent === agent.agentName ? null : agent.agentName)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          selectedAgent === agent.agentName
                            ? 'bg-yellow-500 text-slate-900'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
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
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
            {selectedAgentRecords.agentName}'s Complete Records
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Volume Records */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Volume Records</h4>
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
                            <div className="text-slate-400 mb-1">{formatPeriodName(period)}</div>
                            {record ? (
                              <>
                                <div className="text-white font-bold">
                                  {formatRecordValue(metric, record.value)}
                                </div>
                                <div className="text-slate-500 text-[10px]">
                                  {formatDateRange(record.periodStart, record.periodEnd)}
                                </div>
                              </>
                            ) : (
                              <div className="text-slate-600">—</div>
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
              <h4 className="text-sm font-medium text-slate-300 mb-3">Rate Records</h4>
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
                            <div className="text-slate-400 mb-1">{formatPeriodName(period)}</div>
                            {record ? (
                              <>
                                <div className="text-white font-bold">
                                  {formatRecordValue(metric, record.value)}
                                </div>
                                <div className="text-slate-500 text-[10px]">
                                  {formatDateRange(record.periodStart, record.periodEnd)}
                                </div>
                              </>
                            ) : (
                              <div className="text-slate-600">—</div>
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
    </div>
  );
};
