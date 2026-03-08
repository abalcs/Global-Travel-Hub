import React, { useState, useMemo, useCallback } from 'react';
import type { Metrics, Team } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { DateRangeFilter } from './DateRangeFilter';
import { PresentationGenerator } from './PresentationGenerator';
import type { RawParsedData } from '../utils/indexedDB';
import type { AllRecords } from '../utils/recordsTracker';

interface TeamComparisonProps {
  metrics: Metrics[];
  teams: Team[];
  seniors: string[];
  rawData?: RawParsedData | null;
  records?: AllRecords | null;
  startDate?: string;
  endDate?: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApplyDateRange: () => void;
  onClearDateRange: () => void;
}

type SortKey = 'name' | 'trips' | 'quotes' | 'passthroughs' | 'tq' | 'tp' | 'pq' | 'hotPass' | 'bookings' | 'nonConverted' | 'potentialTQ';
const formatPercent = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
};


export const TeamComparison: React.FC<TeamComparisonProps> = ({ metrics, teams, seniors, rawData, records, startDate = '', endDate = '', onStartDateChange, onEndDateChange, onApplyDateRange, onClearDateRange }) => {
  const { isAudley } = useTheme();
  const [isOpen, setIsOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('trips');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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
            ? 'bg-gradient-to-r from-[#0a1628] to-[#1a2a40] hover:from-[#060f1c] hover:to-[#0a1628]'
            : 'bg-gradient-to-r from-[#1a5c6e] to-[#2a7a8c] hover:from-[#15506a] hover:to-[#246e80]'
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
          {/* Date Range Filter + Update + Generate Slides */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={onStartDateChange}
                onEndDateChange={onEndDateChange}
                onClear={onClearDateRange}
              />
              <button
                onClick={onApplyDateRange}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isAudley
                    ? 'bg-[#c4956a] text-white hover:bg-[#b0845d] shadow-sm'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                Update
              </button>
            </div>
            <div className="hidden md:block">
              <PresentationGenerator metrics={metrics} seniors={seniors} teams={teams} rawData={rawData} records={records} startDate={startDate} endDate={endDate} />
            </div>
          </div>


          {/* Team Comparison */}
          {teams.length >= 2 && (
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
                                ? 'bg-[#faf8f5] text-[#0a1628] border-[#ede8e0]'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'text-gray-600 border-gray-200'
                          }`}
                        >
                          <div>{team.name}</div>
                          {idx === 0 && sortKey !== 'name' && (
                            <span className={`inline-block mt-1 text-white text-xs px-1.5 py-0.5 rounded-full ${
                              isAudley ? 'bg-[#c4956a]' : 'bg-amber-500'
                            }`}>#1</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metricRows.map((row, rowIdx) => {
                      const allValues = getAllValues(row.key);
                      const isHighlightedRow = sortKey !== 'name' && row.key === sortKey;
                      return (
                        <tr key={row.key} className={isHighlightedRow
                          ? isAudley
                            ? 'bg-[#faf8f5]'
                            : 'bg-indigo-50/70'
                          : rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }>
                          <td
                            onClick={() => handleSort(row.key as SortKey)}
                            className={`px-4 py-3 text-sm font-medium border-b sticky left-0 cursor-pointer select-none hover:opacity-80 ${
                            isHighlightedRow
                              ? isAudley
                                ? 'bg-[#faf8f5] text-[#c4956a] font-bold border-[#ede8e0]'
                                : 'bg-indigo-50/70 text-indigo-700 font-bold border-indigo-200'
                              : `text-gray-700 border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`
                          }`}>
                            {row.label}
                            {isHighlightedRow && <span className="ml-1 text-xs">{sortDir === 'desc' ? '↓' : '↑'}</span>}
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
                                      ? 'bg-[#faf8f5] border-[#ede8e0]'
                                      : 'bg-amber-50/50 border-amber-100'
                                    : isHighlightedRow
                                      ? isAudley
                                        ? 'border-[#ede8e0]'
                                        : 'border-indigo-100'
                                      : 'border-gray-100'
                                } ${colorClass} ${isHighlightedRow ? 'font-semibold' : ''}`}
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


          {/* Senior vs Non-Senior Comparison */}
          {hasSeniors && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <svg className={`w-5 h-5 ${isAudley ? 'text-[#c4956a]' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 24 24">
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
                          ? 'text-[#0a1628] border-[#ede8e0] bg-[#faf8f5]'
                          : 'text-amber-800 border-amber-200 bg-amber-50'
                      }`}>
                        <div className="flex items-center justify-center gap-1">
                          <svg className={`w-4 h-4 ${isAudley ? 'text-[#c4956a]' : 'text-amber-600'}`} fill="currentColor" viewBox="0 0 24 24">
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
                              ? 'border-[#ede8e0] bg-[#faf8f5]'
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

          </div>
        </div>
      </div>
    </div>
  );
};
