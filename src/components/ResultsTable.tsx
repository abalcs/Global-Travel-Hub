import React, { useState, useMemo } from 'react';
import type { Metrics, Team } from '../types';

interface ResultsTableProps {
  metrics: Metrics[];
  teams: Team[];
  seniors: string[];
  newHires: string[];
}

type SeniorFilter = 'all' | 'seniors' | 'non-seniors' | 'new-hires';

type SortColumn = 'trips' | 'quotes' | 'passthroughs' | 'quotesFromTrips' | 'passthroughsFromTrips' | 'quotesFromPassthroughs' | 'hotPassRate' | 'bookings' | 'nonConvertedRate' | null;
type SortDirection = 'asc' | 'desc';

const formatPercent = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
};

export const ResultsTable: React.FC<ResultsTableProps> = ({ metrics, teams, seniors, newHires }) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [seniorFilter, setSeniorFilter] = useState<SeniorFilter>('all');

  const getTeamForAgent = (agentName: string): Team | undefined => {
    return teams.find((team) => team.agentNames.includes(agentName));
  };

  const isSenior = (agentName: string): boolean => {
    return seniors.includes(agentName);
  };

  const isNewHire = (agentName: string): boolean => {
    return newHires.includes(agentName);
  };

  // Filter metrics by selected team and senior status
  const filteredMetrics = useMemo(() => {
    let filtered = metrics;

    // Remove agents named "total" or "subtotal" with zero volume/rates
    filtered = filtered.filter(m => {
      const nameLower = m.agentName.toLowerCase();
      const isTotalRow = nameLower.includes('total') || nameLower.includes('subtotal');
      if (isTotalRow) {
        const hasZeroValues = m.trips === 0 && m.quotes === 0 && m.passthroughs === 0;
        return !hasZeroValues;
      }
      return true;
    });

    // Filter by team
    if (selectedTeam !== 'all') {
      const team = teams.find(t => t.id === selectedTeam);
      if (team) {
        filtered = filtered.filter(m => team.agentNames.includes(m.agentName));
      }
    }

    // Filter by senior/new hire status
    if (seniorFilter === 'seniors') {
      filtered = filtered.filter(m => seniors.includes(m.agentName));
    } else if (seniorFilter === 'non-seniors') {
      filtered = filtered.filter(m => !seniors.includes(m.agentName));
    } else if (seniorFilter === 'new-hires') {
      filtered = filtered.filter(m => newHires.includes(m.agentName));
    }

    return filtered;
  }, [metrics, teams, selectedTeam, seniors, newHires, seniorFilter]);

  // Sort metrics
  const sortedMetrics = useMemo(() => {
    if (!sortColumn) return filteredMetrics;

    return [...filteredMetrics].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      const modifier = sortDirection === 'asc' ? 1 : -1;
      return (aVal - bVal) * modifier;
    });
  }, [filteredMetrics, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Calculate totals for the filtered/sorted metrics
  const totals = useMemo(() => sortedMetrics.reduce(
    (acc, m) => ({
      trips: acc.trips + m.trips,
      quotes: acc.quotes + m.quotes,
      passthroughs: acc.passthroughs + m.passthroughs,
      hotPasses: acc.hotPasses + m.hotPasses,
      bookings: acc.bookings + m.bookings,
      nonConvertedLeads: acc.nonConvertedLeads + m.nonConvertedLeads,
      totalLeads: acc.totalLeads + m.totalLeads,
    }),
    { trips: 0, quotes: 0, passthroughs: 0, hotPasses: 0, bookings: 0, nonConvertedLeads: 0, totalLeads: 0 }
  ), [sortedMetrics]);

  const totalMetrics = useMemo(() => ({
    quotesFromTrips: totals.trips > 0 ? (totals.quotes / totals.trips) * 100 : 0,
    passthroughsFromTrips: totals.trips > 0 ? (totals.passthroughs / totals.trips) * 100 : 0,
    quotesFromPassthroughs: totals.passthroughs > 0 ? (totals.quotes / totals.passthroughs) * 100 : 0,
    hotPassRate: totals.passthroughs > 0 ? (totals.hotPasses / totals.passthroughs) * 100 : 0,
    nonConvertedRate: totals.totalLeads > 0 ? (totals.nonConvertedLeads / totals.totalLeads) * 100 : 0,
  }), [totals]);

  // Determine the label for the totals row based on active filters
  const getTotalsLabel = () => {
    const parts: string[] = [];

    if (selectedTeam !== 'all') {
      const team = teams.find(t => t.id === selectedTeam);
      if (team) parts.push(team.name);
    }

    if (seniorFilter === 'seniors') {
      parts.push('Seniors');
    } else if (seniorFilter === 'non-seniors') {
      parts.push('Non-Seniors');
    } else if (seniorFilter === 'new-hires') {
      parts.push('New Hires');
    }

    if (parts.length === 0) {
      return 'Department Total';
    }

    return parts.join(' ') + ' Total';
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 ml-1 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'desc' ? (
      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  };

  if (metrics.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Data Available</h3>
        <p className="text-sm text-gray-500">Upload all three Excel files to see the results</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">KPI Results</h2>

        <div className="flex items-center gap-4">
          {(seniors.length > 0 || newHires.length > 0) && (
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Filter:</label>
              <select
                value={seniorFilter}
                onChange={(e) => setSeniorFilter(e.target.value as SeniorFilter)}
                className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="all" className="text-gray-800">All Agents</option>
                {seniors.length > 0 && (
                  <option value="seniors" className="text-gray-800">Seniors Only</option>
                )}
                {seniors.length > 0 && (
                  <option value="non-seniors" className="text-gray-800">Non-Seniors Only</option>
                )}
                {newHires.length > 0 && (
                  <option value="new-hires" className="text-gray-800">New Hires Only</option>
                )}
              </select>
            </div>
          )}

          {teams.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Team:</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="all" className="text-gray-800">All Teams</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id} className="text-gray-800">
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Team
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('trips')}
              >
                <div className="flex items-center justify-center">
                  Trips
                  <SortIcon column="trips" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('quotes')}
              >
                <div className="flex items-center justify-center">
                  Quotes
                  <SortIcon column="quotes" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('passthroughs')}
              >
                <div className="flex items-center justify-center">
                  Passthroughs
                  <SortIcon column="passthroughs" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-blue-600 uppercase tracking-wider cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('quotesFromTrips')}
              >
                <div className="flex items-center justify-center">
                  T&gt;Q
                  <SortIcon column="quotesFromTrips" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-green-600 uppercase tracking-wider cursor-pointer hover:bg-green-50 transition-colors"
                onClick={() => handleSort('passthroughsFromTrips')}
              >
                <div className="flex items-center justify-center">
                  T&gt;P
                  <SortIcon column="passthroughsFromTrips" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-purple-600 uppercase tracking-wider cursor-pointer hover:bg-purple-50 transition-colors"
                onClick={() => handleSort('quotesFromPassthroughs')}
              >
                <div className="flex items-center justify-center">
                  P&gt;Q
                  <SortIcon column="quotesFromPassthroughs" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-orange-600 uppercase tracking-wider cursor-pointer hover:bg-orange-50 transition-colors"
                onClick={() => handleSort('hotPassRate')}
              >
                <div className="flex items-center justify-center">
                  Hot Pass
                  <SortIcon column="hotPassRate" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-cyan-600 uppercase tracking-wider cursor-pointer hover:bg-cyan-50 transition-colors"
                onClick={() => handleSort('bookings')}
              >
                <div className="flex items-center justify-center">
                  Bookings
                  <SortIcon column="bookings" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-xs font-semibold text-rose-600 uppercase tracking-wider cursor-pointer hover:bg-rose-50 transition-colors"
                onClick={() => handleSort('nonConvertedRate')}
              >
                <div className="flex items-center justify-center">
                  % Non-Conv
                  <SortIcon column="nonConvertedRate" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedMetrics.map((m, idx) => {
              const team = getTeamForAgent(m.agentName);
              return (
                <tr key={m.agentName} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {m.agentName}
                      {isSenior(m.agentName) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                          Sr
                        </span>
                      )}
                      {isNewHire(m.agentName) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-sky-100 text-sky-800">
                          New
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {team ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {team.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                    {m.trips}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                    {m.quotes}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                    {m.passthroughs}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-center">
                    {formatPercent(m.quotesFromTrips)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-center">
                    {formatPercent(m.passthroughsFromTrips)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-purple-600 text-center">
                    {formatPercent(m.quotesFromPassthroughs)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600 text-center">
                    {formatPercent(m.hotPassRate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-cyan-600 text-center">
                    {m.bookings}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-rose-600 text-center">
                    {formatPercent(m.nonConvertedRate)}
                  </td>
                </tr>
              );
            })}

            {/* Totals Row */}
            <tr className="bg-gradient-to-r from-gray-800 to-gray-900">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                {getTotalsLabel()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">—</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center font-bold">
                {totals.trips}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center font-bold">
                {totals.quotes}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center font-bold">
                {totals.passthroughs}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-300 text-center">
                {formatPercent(totalMetrics.quotesFromTrips)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-300 text-center">
                {formatPercent(totalMetrics.passthroughsFromTrips)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-300 text-center">
                {formatPercent(totalMetrics.quotesFromPassthroughs)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-300 text-center">
                {formatPercent(totalMetrics.hotPassRate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-cyan-300 text-center">
                {totals.bookings}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-rose-300 text-center">
                {formatPercent(totalMetrics.nonConvertedRate)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
