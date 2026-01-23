import React, { useState, useMemo } from 'react';
import type { Metrics, Team } from '../types';

interface ResultsTableProps {
  metrics: Metrics[];
  teams: Team[];
  seniors: string[];
  newHires: string[];
}

type SeniorFilter = 'all' | 'seniors' | 'non-seniors' | 'new-hires';

type SortColumn = 'trips' | 'quotes' | 'passthroughs' | 'repeatTrips' | 'repeatPassthroughs' | 'repeatTpRate' | 'b2bTrips' | 'b2bPassthroughs' | 'b2bTpRate' | 'passthroughsFromTrips' | 'quotesFromTrips' | 'quotesFromPassthroughs' | 'hotPassRate' | 'bookings' | 'nonConvertedRate' | null;

// Columns that can be toggled on/off
interface ColumnVisibility {
  repeatTrips: boolean;
  repeatPassthroughs: boolean;
  repeatTpRate: boolean;
  b2bTrips: boolean;
  b2bPassthroughs: boolean;
  b2bTpRate: boolean;
}
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
  const [showColumnSettings, setShowColumnSettings] = useState<boolean>(false);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    repeatTrips: false,
    repeatPassthroughs: false,
    repeatTpRate: true,
    b2bTrips: false,
    b2bPassthroughs: false,
    b2bTpRate: false,
  });

  const allColumnsVisible = Object.values(columnVisibility).every(v => v);
  const noColumnsVisible = Object.values(columnVisibility).every(v => !v);

  const selectAllColumns = () => {
    setColumnVisibility({
      repeatTrips: true,
      repeatPassthroughs: true,
      repeatTpRate: true,
      b2bTrips: true,
      b2bPassthroughs: true,
      b2bTpRate: true,
    });
  };

  const deselectAllColumns = () => {
    setColumnVisibility({
      repeatTrips: false,
      repeatPassthroughs: false,
      repeatTpRate: false,
      b2bTrips: false,
      b2bPassthroughs: false,
      b2bTpRate: false,
    });
  };

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

  const toggleColumn = (column: keyof ColumnVisibility) => {
    setColumnVisibility(prev => ({ ...prev, [column]: !prev[column] }));
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
      repeatTrips: acc.repeatTrips + m.repeatTrips,
      repeatPassthroughs: acc.repeatPassthroughs + m.repeatPassthroughs,
      b2bTrips: acc.b2bTrips + m.b2bTrips,
      b2bPassthroughs: acc.b2bPassthroughs + m.b2bPassthroughs,
    }),
    { trips: 0, quotes: 0, passthroughs: 0, hotPasses: 0, bookings: 0, nonConvertedLeads: 0, totalLeads: 0, repeatTrips: 0, repeatPassthroughs: 0, b2bTrips: 0, b2bPassthroughs: 0 }
  ), [sortedMetrics]);

  const totalMetrics = useMemo(() => ({
    quotesFromTrips: totals.trips > 0 ? (totals.quotes / totals.trips) * 100 : 0,
    passthroughsFromTrips: totals.trips > 0 ? (totals.passthroughs / totals.trips) * 100 : 0,
    quotesFromPassthroughs: totals.passthroughs > 0 ? (totals.quotes / totals.passthroughs) * 100 : 0,
    hotPassRate: totals.passthroughs > 0 ? (totals.hotPasses / totals.passthroughs) * 100 : 0,
    nonConvertedRate: totals.totalLeads > 0 ? (totals.nonConvertedLeads / totals.totalLeads) * 100 : 0,
    repeatTpRate: totals.repeatTrips > 0 ? (totals.repeatPassthroughs / totals.repeatTrips) * 100 : 0,
    b2bTpRate: totals.b2bTrips > 0 ? (totals.b2bPassthroughs / totals.b2bTrips) * 100 : 0,
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
                className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
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
                className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
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

          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-95 ${
              showColumnSettings
                ? 'bg-white text-indigo-600'
                : 'bg-white/20 text-white border border-white/30 hover:bg-white/30'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Columns
            </div>
          </button>
        </div>
      </div>

      {/* Column visibility toggles with smooth transition */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          showColumnSettings ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-6 py-3 bg-gray-100 border-b border-gray-200 flex items-center gap-6 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Show columns:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllColumns}
                disabled={allColumnsVisible}
                className="px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                All
              </button>
              <button
                onClick={deselectAllColumns}
                disabled={noColumnsVisible}
                className="px-2 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                None
              </button>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnVisibility.repeatTrips}
                  onChange={() => toggleColumn('repeatTrips')}
                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Repeat Trips</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnVisibility.repeatPassthroughs}
                  onChange={() => toggleColumn('repeatPassthroughs')}
                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Repeat TP</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnVisibility.repeatTpRate}
                  onChange={() => toggleColumn('repeatTpRate')}
                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Repeat T&gt;P %</span>
              </label>
              <div className="h-4 w-px bg-gray-300" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnVisibility.b2bTrips}
                  onChange={() => toggleColumn('b2bTrips')}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">B2B Trips</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnVisibility.b2bPassthroughs}
                  onChange={() => toggleColumn('b2bPassthroughs')}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">B2B TP</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnVisibility.b2bTpRate}
                  onChange={() => toggleColumn('b2bTpRate')}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">B2B T&gt;P %</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
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
              {columnVisibility.repeatTrips && (
                <th
                  className="px-6 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider cursor-pointer hover:bg-violet-50 transition-colors"
                  onClick={() => handleSort('repeatTrips')}
                >
                  <div className="flex items-center justify-center">
                    Repeat Trips
                    <SortIcon column="repeatTrips" />
                  </div>
                </th>
              )}
              {columnVisibility.repeatPassthroughs && (
                <th
                  className="px-6 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider cursor-pointer hover:bg-violet-50 transition-colors"
                  onClick={() => handleSort('repeatPassthroughs')}
                >
                  <div className="flex items-center justify-center">
                    Repeat TP
                    <SortIcon column="repeatPassthroughs" />
                  </div>
                </th>
              )}
              {columnVisibility.repeatTpRate && (
                <th
                  className="px-6 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider cursor-pointer hover:bg-violet-50 transition-colors"
                  onClick={() => handleSort('repeatTpRate')}
                >
                  <div className="flex items-center justify-center">
                    Repeat T&gt;P %
                    <SortIcon column="repeatTpRate" />
                  </div>
                </th>
              )}
              {columnVisibility.b2bTrips && (
                <th
                  className="px-6 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider cursor-pointer hover:bg-teal-50 transition-colors"
                  onClick={() => handleSort('b2bTrips')}
                >
                  <div className="flex items-center justify-center">
                    B2B Trips
                    <SortIcon column="b2bTrips" />
                  </div>
                </th>
              )}
              {columnVisibility.b2bPassthroughs && (
                <th
                  className="px-6 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider cursor-pointer hover:bg-teal-50 transition-colors"
                  onClick={() => handleSort('b2bPassthroughs')}
                >
                  <div className="flex items-center justify-center">
                    B2B TP
                    <SortIcon column="b2bPassthroughs" />
                  </div>
                </th>
              )}
              {columnVisibility.b2bTpRate && (
                <th
                  className="px-6 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider cursor-pointer hover:bg-teal-50 transition-colors"
                  onClick={() => handleSort('b2bTpRate')}
                >
                  <div className="flex items-center justify-center">
                    B2B T&gt;P %
                    <SortIcon column="b2bTpRate" />
                  </div>
                </th>
              )}
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
                className="px-6 py-3 text-center text-xs font-semibold text-blue-600 uppercase tracking-wider cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleSort('quotesFromTrips')}
              >
                <div className="flex items-center justify-center">
                  T&gt;Q
                  <SortIcon column="quotesFromTrips" />
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
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
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
                  {columnVisibility.repeatTrips && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-violet-600 text-center">
                      {m.repeatTrips}
                    </td>
                  )}
                  {columnVisibility.repeatPassthroughs && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-violet-600 text-center">
                      {m.repeatPassthroughs}
                    </td>
                  )}
                  {columnVisibility.repeatTpRate && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-violet-600 text-center">
                      {formatPercent(m.repeatTpRate)}
                    </td>
                  )}
                  {columnVisibility.b2bTrips && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-teal-600 text-center">
                      {m.b2bTrips}
                    </td>
                  )}
                  {columnVisibility.b2bPassthroughs && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-teal-600 text-center">
                      {m.b2bPassthroughs}
                    </td>
                  )}
                  {columnVisibility.b2bTpRate && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-teal-600 text-center">
                      {formatPercent(m.b2bTpRate)}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-center">
                    {formatPercent(m.passthroughsFromTrips)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-center">
                    {formatPercent(m.quotesFromTrips)}
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
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white sticky left-0 z-10 bg-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
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
              {columnVisibility.repeatTrips && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-violet-300 text-center">
                  {totals.repeatTrips}
                </td>
              )}
              {columnVisibility.repeatPassthroughs && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-violet-300 text-center">
                  {totals.repeatPassthroughs}
                </td>
              )}
              {columnVisibility.repeatTpRate && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-violet-300 text-center">
                  {formatPercent(totalMetrics.repeatTpRate)}
                </td>
              )}
              {columnVisibility.b2bTrips && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-teal-300 text-center">
                  {totals.b2bTrips}
                </td>
              )}
              {columnVisibility.b2bPassthroughs && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-teal-300 text-center">
                  {totals.b2bPassthroughs}
                </td>
              )}
              {columnVisibility.b2bTpRate && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-teal-300 text-center">
                  {formatPercent(totalMetrics.b2bTpRate)}
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-300 text-center">
                {formatPercent(totalMetrics.passthroughsFromTrips)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-300 text-center">
                {formatPercent(totalMetrics.quotesFromTrips)}
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
