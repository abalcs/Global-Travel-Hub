import React, { useState, useMemo, useCallback } from 'react';
import type { Metrics, Team } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface TeamComparisonProps {
  metrics: Metrics[];
  teams: Team[];
  seniors: string[];
}

type SortKey = 'name' | 'trips' | 'quotes' | 'passthroughs' | 'tq' | 'tp' | 'pq' | 'hotPass' | 'bookings' | 'nonConverted' | 'potentialTQ';
type ViewMode = 'cards' | 'table';

const formatPercent = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
};

const COLOR_CLASSES: Record<string, { active: string; inactive: string }> = {
  gray: {
    active: 'bg-gray-600 text-white',
    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  },
  blue: {
    active: 'bg-blue-600 text-white',
    inactive: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  },
  green: {
    active: 'bg-green-600 text-white',
    inactive: 'bg-green-100 text-green-700 hover:bg-green-200',
  },
  purple: {
    active: 'bg-purple-600 text-white',
    inactive: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  },
  orange: {
    active: 'bg-orange-600 text-white',
    inactive: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  },
  cyan: {
    active: 'bg-cyan-600 text-white',
    inactive: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200',
  },
  rose: {
    active: 'bg-rose-600 text-white',
    inactive: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
  },
  amber: {
    active: 'bg-amber-600 text-white',
    inactive: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  },
};

interface SortButtonProps {
  label: string;
  sortKeyVal: SortKey;
  color?: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}

const SortButton: React.FC<SortButtonProps> = ({ label, sortKeyVal, color = 'gray', sortKey, sortDir, onSort }) => {
  const classes = COLOR_CLASSES[color] || COLOR_CLASSES.gray;
  return (
    <button
      onClick={() => onSort(sortKeyVal)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        sortKey === sortKeyVal ? classes.active : classes.inactive
      }`}
    >
      {label}
      {sortKey === sortKeyVal && (
        <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
      )}
    </button>
  );
};

export const TeamComparison: React.FC<TeamComparisonProps> = ({ metrics, teams, seniors }) => {
  const { isAudley } = useTheme();
  const [isOpen, setIsOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('trips');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // PERF: Memoize senior filtering - O(n) per filter, avoid recalc on sort/view changes
  const seniorMetrics = useMemo(() => metrics.filter(m => seniors.includes(m.agentName)), [metrics, seniors]);
  const nonSeniorMetrics = useMemo(() => metrics.filter(m => !seniors.includes(m.agentName)), [metrics, seniors]);

  // PERF: Memoize with useCallback since it's used in useMemo dependencies
  const calculateGroupTotals = useCallback((groupMetrics: Metrics[]) => {
    const totals = groupMetrics.reduce(
      (acc, m) => ({
        trips: acc.trips + m.trips,
        quotes: acc.quotes + m.quotes,
        passthroughs: acc.passthroughs + m.passthroughs,
        hotPasses: acc.hotPasses + m.hotPasses,
        bookings: acc.bookings + m.bookings,
        nonConvertedLeads: acc.nonConvertedLeads + m.nonConvertedLeads,
        totalLeads: acc.totalLeads + m.totalLeads,
        quotesStarted: acc.quotesStarted + m.quotesStarted,
      }),
      { trips: 0, quotes: 0, passthroughs: 0, hotPasses: 0, bookings: 0, nonConvertedLeads: 0, totalLeads: 0, quotesStarted: 0 }
    );

    return {
      agentCount: groupMetrics.length,
      trips: totals.trips,
      quotes: totals.quotes,
      passthroughs: totals.passthroughs,
      bookings: totals.bookings,
      tq: totals.trips > 0 ? (totals.quotes / totals.trips) * 100 : 0,
      tp: totals.trips > 0 ? (totals.passthroughs / totals.trips) * 100 : 0,
      pq: totals.passthroughs > 0 ? (totals.quotes / totals.passthroughs) * 100 : 0,
      hotPass: totals.passthroughs > 0 ? (totals.hotPasses / totals.passthroughs) * 100 : 0,
      nonConverted: totals.totalLeads > 0 ? (totals.nonConvertedLeads / totals.totalLeads) * 100 : 0,
      potentialTQ: totals.trips > 0 ? ((totals.quotes + totals.quotesStarted) / totals.trips) * 100 : 0,
    };
  }, []);

  // PERF: Memoize group totals - avoid recalculation on sort/view changes
  const seniorData = useMemo(() => calculateGroupTotals(seniorMetrics), [calculateGroupTotals, seniorMetrics]);
  const nonSeniorData = useMemo(() => calculateGroupTotals(nonSeniorMetrics), [calculateGroupTotals, nonSeniorMetrics]);

  const hasSeniors = seniors.length > 0 && seniorMetrics.length > 0;

  // PERF: Memoize team data calculation - O(t*a) where t=teams, a=agents
  const teamData = useMemo(() => teams.map((team) => {
    const teamMetrics = metrics.filter((m) => team.agentNames.includes(m.agentName));
    const totals = teamMetrics.reduce(
      (acc, m) => ({
        trips: acc.trips + m.trips,
        quotes: acc.quotes + m.quotes,
        passthroughs: acc.passthroughs + m.passthroughs,
        hotPasses: acc.hotPasses + m.hotPasses,
        bookings: acc.bookings + m.bookings,
        nonConvertedLeads: acc.nonConvertedLeads + m.nonConvertedLeads,
        totalLeads: acc.totalLeads + m.totalLeads,
        quotesStarted: acc.quotesStarted + m.quotesStarted,
      }),
      { trips: 0, quotes: 0, passthroughs: 0, hotPasses: 0, bookings: 0, nonConvertedLeads: 0, totalLeads: 0, quotesStarted: 0 }
    );

    return {
      id: team.id,
      name: team.name,
      agentCount: team.agentNames.length,
      trips: totals.trips,
      quotes: totals.quotes,
      passthroughs: totals.passthroughs,
      bookings: totals.bookings,
      tq: totals.trips > 0 ? (totals.quotes / totals.trips) * 100 : 0,
      tp: totals.trips > 0 ? (totals.passthroughs / totals.trips) * 100 : 0,
      pq: totals.passthroughs > 0 ? (totals.quotes / totals.passthroughs) * 100 : 0,
      hotPass: totals.passthroughs > 0 ? (totals.hotPasses / totals.passthroughs) * 100 : 0,
      nonConverted: totals.totalLeads > 0 ? (totals.nonConvertedLeads / totals.totalLeads) * 100 : 0,
      potentialTQ: totals.trips > 0 ? ((totals.quotes + totals.quotesStarted) / totals.trips) * 100 : 0,
    };
  }), [teams, metrics]);

  // PERF: Memoize sorted teams - only recalculate when teamData or sort params change
  const sortedTeams = useMemo(() => [...teamData].sort((a, b) => {
    const modifier = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'name') {
      return a.name.localeCompare(b.name) * modifier;
    }
    return (a[sortKey] - b[sortKey]) * modifier;
  }), [teamData, sortKey, sortDir]);

  // PERF: Memoize max values for progress bars
  const { maxTrips, maxQuotes, maxPassthroughs } = useMemo(() => {
    if (teamData.length === 0) {
      return { maxTrips: 0, maxQuotes: 0, maxPassthroughs: 0 };
    }
    return {
      maxTrips: Math.max(...teamData.map(t => t.trips)),
      maxQuotes: Math.max(...teamData.map(t => t.quotes)),
      maxPassthroughs: Math.max(...teamData.map(t => t.passthroughs)),
    };
  }, [teamData]);

  // PERF: Memoize getAllValues with useCallback - must be before early return to follow hook rules
  const getAllValues = useCallback((key: keyof typeof sortedTeams[0]) => sortedTeams.map(t => t[key] as number), [sortedTeams]);

  if (teams.length < 2 && !hasSeniors) {
    return null;
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Calculate relative performance for color coding
  const getRelativeColor = (value: number, allValues: number[], isLowerBetter = false) => {
    if (allValues.length === 0) return 'text-gray-700';
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    if (max === min) return 'text-gray-700';

    const ratio = (value - min) / (max - min);
    const effectiveRatio = isLowerBetter ? 1 - ratio : ratio;

    if (effectiveRatio >= 0.75) return 'text-green-600 font-semibold';
    if (effectiveRatio >= 0.5) return 'text-blue-600';
    if (effectiveRatio >= 0.25) return 'text-gray-700';
    return 'text-rose-500';
  };

  // Table row data configuration
  const metricRows = [
    { label: 'Agents', key: 'agentCount' as const, format: (v: number) => v.toString(), color: 'gray' },
    { label: 'Trips', key: 'trips' as const, format: (v: number) => v.toLocaleString(), color: 'gray' },
    { label: 'Quotes', key: 'quotes' as const, format: (v: number) => v.toLocaleString(), color: 'blue' },
    { label: 'Passthroughs', key: 'passthroughs' as const, format: (v: number) => v.toLocaleString(), color: 'green' },
    { label: 'Bookings', key: 'bookings' as const, format: (v: number) => v.toLocaleString(), color: 'cyan' },
    { label: 'T>Q Rate', key: 'tq' as const, format: formatPercent, color: 'blue' },
    { label: 'Potential T>Q', key: 'potentialTQ' as const, format: formatPercent, color: 'amber' },
    { label: 'T>P Rate', key: 'tp' as const, format: formatPercent, color: 'green' },
    { label: 'P>Q Rate', key: 'pq' as const, format: formatPercent, color: 'purple' },
    { label: 'Hot Pass %', key: 'hotPass' as const, format: formatPercent, color: 'orange' },
    { label: '% Non-Conv', key: 'nonConverted' as const, format: formatPercent, color: 'rose', lowerIsBetter: true },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-6 py-4 flex items-center justify-between text-white transition-all ${
          isAudley
            ? 'bg-gradient-to-r from-[#4d726d] to-[#5d8a84] hover:from-[#3d5c58] hover:to-[#4d7a74]'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
        }`}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-bold text-lg">Team Comparison</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
            {teams.length} teams
          </span>
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-6">
          {/* View Toggle and Sort Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">View:</span>
              <div className="inline-flex rounded-lg border border-gray-200 p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                    viewMode === 'table'
                      ? isAudley ? 'bg-[#4d726d] text-white' : 'bg-amber-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                    viewMode === 'cards'
                      ? isAudley ? 'bg-[#4d726d] text-white' : 'bg-amber-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Cards
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-500 self-center">Sort by:</span>
              <SortButton label="Name" sortKeyVal="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="Trips" sortKeyVal="trips" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="Quotes" sortKeyVal="quotes" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="Passthroughs" sortKeyVal="passthroughs" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="T>Q" sortKeyVal="tq" color="blue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="Potential T>Q" sortKeyVal="potentialTQ" color="amber" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="T>P" sortKeyVal="tp" color="green" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="P>Q" sortKeyVal="pq" color="purple" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="Hot Pass" sortKeyVal="hotPass" color="orange" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="Bookings" sortKeyVal="bookings" color="cyan" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortButton label="% Non-Conv" sortKeyVal="nonConverted" color="rose" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </div>
          </div>

          {/* Team Comparison - Table View */}
          {teams.length >= 2 && viewMode === 'table' && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Team Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 border-b border-gray-200 sticky left-0 bg-gray-50">
                        Metric
                      </th>
                      {sortedTeams.map((team, idx) => (
                        <th
                          key={team.id}
                          className={`px-4 py-3 text-center text-sm font-semibold border-b min-w-[120px] ${
                            idx === 0 && sortKey !== 'name'
                              ? isAudley
                                ? 'bg-[#4d726d]/10 text-[#4d726d] border-[#4d726d]/20'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'text-gray-600 border-gray-200'
                          }`}
                        >
                          <div>{team.name}</div>
                          {idx === 0 && sortKey !== 'name' && (
                            <span className={`inline-block mt-1 text-white text-xs px-1.5 py-0.5 rounded-full ${
                              isAudley ? 'bg-[#4d726d]' : 'bg-amber-500'
                            }`}>#1</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metricRows.map((row, rowIdx) => {
                      const allValues = getAllValues(row.key);
                      return (
                        <tr key={row.key} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className={`px-4 py-3 text-sm font-medium text-gray-700 border-b border-gray-100 sticky left-0 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            {row.label}
                          </td>
                          {sortedTeams.map((team, colIdx) => {
                            const value = team[row.key] as number;
                            const colorClass = row.key === 'agentCount'
                              ? 'text-gray-700'
                              : getRelativeColor(value, allValues, row.lowerIsBetter);
                            return (
                              <td
                                key={team.id}
                                className={`px-4 py-3 text-center text-sm border-b ${
                                  colIdx === 0 && sortKey !== 'name'
                                    ? isAudley
                                      ? 'bg-[#4d726d]/5 border-[#4d726d]/10'
                                      : 'bg-amber-50/50 border-amber-100'
                                    : 'border-gray-100'
                                } ${colorClass}`}
                              >
                                {row.format(value)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Color coding: <span className="text-green-600 font-semibold">best performers</span> / <span className="text-blue-600">above average</span> / <span className="text-gray-700">average</span> / <span className="text-rose-500">below average</span>
              </p>
            </div>
          )}

          {/* Team Comparison - Card View */}
          {teams.length >= 2 && viewMode === 'cards' && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Team Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedTeams.map((team, idx) => (
                  <div
                    key={team.id}
                    className={`relative p-5 rounded-xl border-2 ${
                      idx === 0 && sortKey !== 'name'
                        ? isAudley
                          ? 'border-[#4d726d] bg-[#4d726d]/10'
                          : 'border-amber-400 bg-amber-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {idx === 0 && sortKey !== 'name' && (
                      <div className={`absolute -top-2 -right-2 text-white text-xs font-bold px-2 py-1 rounded-full ${
                        isAudley ? 'bg-[#4d726d]' : 'bg-amber-500'
                      }`}>
                        #1
                      </div>
                    )}

                    <h3 className="text-lg font-bold text-gray-800 mb-1">{team.name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{team.agentCount} agents</p>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Trips</span>
                          <span className="font-semibold">{team.trips}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-500 rounded-full transition-all"
                            style={{ width: `${maxTrips > 0 ? (team.trips / maxTrips) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Quotes</span>
                          <span className="font-semibold">{team.quotes}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${maxQuotes > 0 ? (team.quotes / maxQuotes) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Passthroughs</span>
                          <span className="font-semibold">{team.passthroughs}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${maxPassthroughs > 0 ? (team.passthroughs / maxPassthroughs) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-7 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-blue-600">{formatPercent(team.tq)}</div>
                        <div className="text-xs text-gray-500">T&gt;Q</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber-600">{formatPercent(team.potentialTQ)}</div>
                        <div className="text-xs text-gray-500">Potential</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">{formatPercent(team.tp)}</div>
                        <div className="text-xs text-gray-500">T&gt;P</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-600">{formatPercent(team.pq)}</div>
                        <div className="text-xs text-gray-500">P&gt;Q</div>
                      </div>
                      <div>
                        <div className={`text-lg font-bold ${isAudley ? 'text-[#4d726d]' : 'text-orange-600'}`}>{formatPercent(team.hotPass)}</div>
                        <div className="text-xs text-gray-500">Hot Pass</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-cyan-600">{team.bookings}</div>
                        <div className="text-xs text-gray-500">Bookings</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-rose-600">{formatPercent(team.nonConverted)}</div>
                        <div className="text-xs text-gray-500">% Non-Conv</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Senior vs Non-Senior Comparison - Table View */}
          {hasSeniors && viewMode === 'table' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <svg className={`w-5 h-5 ${isAudley ? 'text-[#4d726d]' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Senior vs Non-Senior Comparison
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse max-w-xl">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 border-b border-gray-200">
                        Metric
                      </th>
                      <th className={`px-4 py-3 text-center text-sm font-semibold border-b min-w-[120px] ${
                        isAudley
                          ? 'text-[#4d726d] border-[#4d726d]/20 bg-[#4d726d]/10'
                          : 'text-amber-800 border-amber-200 bg-amber-50'
                      }`}>
                        <div className="flex items-center justify-center gap-1">
                          <svg className={`w-4 h-4 ${isAudley ? 'text-[#4d726d]' : 'text-amber-600'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                          Seniors
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600 border-b border-gray-200 min-w-[120px]">
                        Non-Seniors
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-500 border-b border-gray-200 min-w-[100px]">
                        Difference
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Agents', senior: seniorData.agentCount, nonSenior: nonSeniorData.agentCount, format: (v: number) => v.toString(), isPercent: false },
                      { label: 'Trips', senior: seniorData.trips, nonSenior: nonSeniorData.trips, format: (v: number) => v.toLocaleString(), isPercent: false },
                      { label: 'Quotes', senior: seniorData.quotes, nonSenior: nonSeniorData.quotes, format: (v: number) => v.toLocaleString(), isPercent: false },
                      { label: 'Passthroughs', senior: seniorData.passthroughs, nonSenior: nonSeniorData.passthroughs, format: (v: number) => v.toLocaleString(), isPercent: false },
                      { label: 'Bookings', senior: seniorData.bookings, nonSenior: nonSeniorData.bookings, format: (v: number) => v.toLocaleString(), isPercent: false },
                      { label: 'T>Q Rate', senior: seniorData.tq, nonSenior: nonSeniorData.tq, format: formatPercent, isPercent: true },
                      { label: 'Potential T>Q', senior: seniorData.potentialTQ, nonSenior: nonSeniorData.potentialTQ, format: formatPercent, isPercent: true },
                      { label: 'T>P Rate', senior: seniorData.tp, nonSenior: nonSeniorData.tp, format: formatPercent, isPercent: true },
                      { label: 'P>Q Rate', senior: seniorData.pq, nonSenior: nonSeniorData.pq, format: formatPercent, isPercent: true },
                      { label: 'Hot Pass %', senior: seniorData.hotPass, nonSenior: nonSeniorData.hotPass, format: formatPercent, isPercent: true },
                      { label: '% Non-Conv', senior: seniorData.nonConverted, nonSenior: nonSeniorData.nonConverted, format: formatPercent, isPercent: true, lowerBetter: true },
                    ].map((row, rowIdx) => {
                      const diff = row.senior - row.nonSenior;
                      const diffPositive = row.lowerBetter ? diff < 0 : diff > 0;
                      return (
                        <tr key={row.label} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-700 border-b border-gray-100">
                            {row.label}
                          </td>
                          <td className={`px-4 py-2.5 text-center text-sm border-b font-medium ${
                            isAudley
                              ? 'border-[#4d726d]/10 bg-[#4d726d]/5'
                              : 'border-amber-100 bg-amber-50/50'
                          }`}>
                            {row.format(row.senior)}
                          </td>
                          <td className="px-4 py-2.5 text-center text-sm border-b border-gray-100">
                            {row.format(row.nonSenior)}
                          </td>
                          <td className={`px-4 py-2.5 text-center text-sm border-b border-gray-100 font-medium ${
                            row.label === 'Agents' ? 'text-gray-500' :
                            diffPositive ? 'text-green-600' : diff === 0 ? 'text-gray-500' : 'text-rose-500'
                          }`}>
                            {row.label === 'Agents' ? '—' :
                              diff === 0 ? '—' :
                              `${diff > 0 ? '+' : ''}${row.isPercent ? diff.toFixed(1) + 'pp' : diff.toLocaleString()}`
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">pp = percentage points</p>
            </div>
          )}

          {/* Senior vs Non-Senior Comparison - Card View */}
          {hasSeniors && viewMode === 'cards' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <svg className={`w-5 h-5 ${isAudley ? 'text-[#4d726d]' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Senior vs Non-Senior Comparison
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seniors Card */}
                <div className={`relative p-5 rounded-xl border-2 ${
                  isAudley
                    ? 'border-[#4d726d] bg-[#4d726d]/10'
                    : 'border-amber-400 bg-amber-50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <svg className={`w-5 h-5 ${isAudley ? 'text-[#4d726d]' : 'text-amber-600'}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <h3 className={`text-lg font-bold ${isAudley ? 'text-[#4d726d]' : 'text-amber-800'}`}>Seniors</h3>
                  </div>
                  <p className={`text-sm mb-4 ${isAudley ? 'text-[#4d726d]/80' : 'text-amber-600'}`}>{seniorData.agentCount} agents</p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Trips</span>
                        <span className="font-semibold">{seniorData.trips}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-500 rounded-full transition-all"
                          style={{ width: `${Math.max(seniorData.trips, nonSeniorData.trips) > 0 ? (seniorData.trips / Math.max(seniorData.trips, nonSeniorData.trips)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Quotes</span>
                        <span className="font-semibold">{seniorData.quotes}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.max(seniorData.quotes, nonSeniorData.quotes) > 0 ? (seniorData.quotes / Math.max(seniorData.quotes, nonSeniorData.quotes)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Passthroughs</span>
                        <span className="font-semibold">{seniorData.passthroughs}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.max(seniorData.passthroughs, nonSeniorData.passthroughs) > 0 ? (seniorData.passthroughs / Math.max(seniorData.passthroughs, nonSeniorData.passthroughs)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`mt-4 pt-4 border-t grid grid-cols-7 gap-2 text-center ${
                    isAudley ? 'border-[#4d726d]/20' : 'border-amber-200'
                  }`}>
                    <div>
                      <div className="text-lg font-bold text-blue-600">{formatPercent(seniorData.tq)}</div>
                      <div className="text-xs text-gray-500">T&gt;Q</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-amber-600">{formatPercent(seniorData.potentialTQ)}</div>
                      <div className="text-xs text-gray-500">Potential</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">{formatPercent(seniorData.tp)}</div>
                      <div className="text-xs text-gray-500">T&gt;P</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">{formatPercent(seniorData.pq)}</div>
                      <div className="text-xs text-gray-500">P&gt;Q</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${isAudley ? 'text-[#4d726d]' : 'text-orange-600'}`}>{formatPercent(seniorData.hotPass)}</div>
                      <div className="text-xs text-gray-500">Hot Pass</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-cyan-600">{seniorData.bookings}</div>
                      <div className="text-xs text-gray-500">Bookings</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-rose-600">{formatPercent(seniorData.nonConverted)}</div>
                      <div className="text-xs text-gray-500">% Non-Conv</div>
                    </div>
                  </div>
                </div>

                {/* Non-Seniors Card */}
                <div className="relative p-5 rounded-xl border-2 border-gray-300 bg-gray-50">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">Non-Seniors</h3>
                  <p className="text-sm text-gray-500 mb-4">{nonSeniorData.agentCount} agents</p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Trips</span>
                        <span className="font-semibold">{nonSeniorData.trips}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-500 rounded-full transition-all"
                          style={{ width: `${Math.max(seniorData.trips, nonSeniorData.trips) > 0 ? (nonSeniorData.trips / Math.max(seniorData.trips, nonSeniorData.trips)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Quotes</span>
                        <span className="font-semibold">{nonSeniorData.quotes}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.max(seniorData.quotes, nonSeniorData.quotes) > 0 ? (nonSeniorData.quotes / Math.max(seniorData.quotes, nonSeniorData.quotes)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Passthroughs</span>
                        <span className="font-semibold">{nonSeniorData.passthroughs}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.max(seniorData.passthroughs, nonSeniorData.passthroughs) > 0 ? (nonSeniorData.passthroughs / Math.max(seniorData.passthroughs, nonSeniorData.passthroughs)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-7 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{formatPercent(nonSeniorData.tq)}</div>
                      <div className="text-xs text-gray-500">T&gt;Q</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-amber-600">{formatPercent(nonSeniorData.potentialTQ)}</div>
                      <div className="text-xs text-gray-500">Potential</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">{formatPercent(nonSeniorData.tp)}</div>
                      <div className="text-xs text-gray-500">T&gt;P</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">{formatPercent(nonSeniorData.pq)}</div>
                      <div className="text-xs text-gray-500">P&gt;Q</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${isAudley ? 'text-[#4d726d]' : 'text-orange-600'}`}>{formatPercent(nonSeniorData.hotPass)}</div>
                      <div className="text-xs text-gray-500">Hot Pass</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-cyan-600">{nonSeniorData.bookings}</div>
                      <div className="text-xs text-gray-500">Bookings</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-rose-600">{formatPercent(nonSeniorData.nonConverted)}</div>
                      <div className="text-xs text-gray-500">% Non-Conv</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
