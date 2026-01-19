import React, { useState, useMemo } from 'react';
import type { Metrics, Team } from '../types';

interface ResultsTableProps {
  metrics: Metrics[];
  teams: Team[];
  seniors: string[];
}

type SeniorFilter = 'all' | 'seniors' | 'non-seniors';

type SortColumn = 'quotesFromTrips' | 'passthroughsFromTrips' | 'quotesFromPassthroughs' | 'hotPassRate' | 'bookings' | 'nonConvertedRate' | null;
type SortDirection = 'asc' | 'desc';

const formatPercent = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
};

export const ResultsTable: React.FC<ResultsTableProps> = ({ metrics, teams, seniors }) => {
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

  // Filter metrics by selected team and senior status
  const filteredMetrics = useMemo(() => {
    let filtered = metrics;

    // Filter by team
    if (selectedTeam !== 'all') {
      const team = teams.find(t => t.id === selectedTeam);
      if (team) {
        filtered = filtered.filter(m => team.agentNames.includes(m.agentName));
      }
    }

    // Filter by senior status
    if (seniorFilter === 'seniors') {
      filtered = filtered.filter(m => seniors.includes(m.agentName));
    } else if (seniorFilter === 'non-seniors') {
      filtered = filtered.filter(m => !seniors.includes(m.agentName));
    }

    return filtered;
  }, [metrics, teams, selectedTeam, seniors, seniorFilter]);

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

  const totals = sortedMetrics.reduce(
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
  );

  const totalMetrics = {
    quotesFromTrips: totals.trips > 0 ? (totals.quotes / totals.trips) * 100 : 0,
    passthroughsFromTrips: totals.trips > 0 ? (totals.passthroughs / totals.trips) * 100 : 0,
    quotesFromPassthroughs: totals.passthroughs > 0 ? (totals.quotes / totals.passthroughs) * 100 : 0,
    hotPassRate: totals.passthroughs > 0 ? (totals.hotPasses / totals.passthroughs) * 100 : 0,
    nonConvertedRate: totals.totalLeads > 0 ? (totals.nonConvertedLeads / totals.totalLeads) * 100 : 0,
  };

  const teamAggregates = teams.map((team) => {
    const teamMetrics = metrics.filter((m) => team.agentNames.includes(m.agentName));
    const teamTotals = teamMetrics.reduce(
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
    );

    return {
      teamName: team.name,
      teamId: team.id,
      trips: teamTotals.trips,
      quotes: teamTotals.quotes,
      passthroughs: teamTotals.passthroughs,
      hotPasses: teamTotals.hotPasses,
      bookings: teamTotals.bookings,
      quotesFromTrips: teamTotals.trips > 0 ? (teamTotals.quotes / teamTotals.trips) * 100 : 0,
      passthroughsFromTrips: teamTotals.trips > 0 ? (teamTotals.passthroughs / teamTotals.trips) * 100 : 0,
      quotesFromPassthroughs: teamTotals.passthroughs > 0 ? (teamTotals.quotes / teamTotals.passthroughs) * 100 : 0,
      hotPassRate: teamTotals.passthroughs > 0 ? (teamTotals.hotPasses / teamTotals.passthroughs) * 100 : 0,
      nonConvertedRate: teamTotals.totalLeads > 0 ? (teamTotals.nonConvertedLeads / teamTotals.totalLeads) * 100 : 0,
    };
  });

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
          {seniors.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Seniority:</label>
              <select
                value={seniorFilter}
                onChange={(e) => setSeniorFilter(e.target.value as SeniorFilter)}
                className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="all" className="text-gray-800">All Agents</option>
                <option value="seniors" className="text-gray-800">Seniors Only</option>
                <option value="non-seniors" className="text-gray-800">Non-Seniors Only</option>
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
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Trips
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Quotes
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Passthroughs
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

            {selectedTeam === 'all' && teamAggregates.length > 0 && (
              <>
                <tr className="bg-indigo-50">
                  <td colSpan={11} className="px-6 py-2 text-xs font-semibold text-indigo-600 uppercase">
                    Team Totals
                  </td>
                </tr>
                {teamAggregates.map((ta) => (
                  <tr key={ta.teamName} className="bg-indigo-50/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-900">
                      {ta.teamName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">—</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-700 text-center font-medium">
                      {ta.trips}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-700 text-center font-medium">
                      {ta.quotes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-700 text-center font-medium">
                      {ta.passthroughs}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-700 text-center">
                      {formatPercent(ta.quotesFromTrips)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-700 text-center">
                      {formatPercent(ta.passthroughsFromTrips)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-700 text-center">
                      {formatPercent(ta.quotesFromPassthroughs)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-700 text-center">
                      {formatPercent(ta.hotPassRate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-cyan-700 text-center">
                      {ta.bookings}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-rose-700 text-center">
                      {formatPercent(ta.nonConvertedRate)}
                    </td>
                  </tr>
                ))}
              </>
            )}

            <tr className="bg-gradient-to-r from-gray-800 to-gray-900">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                {selectedTeam === 'all' ? 'Department Total' : 'Team Total'}
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
