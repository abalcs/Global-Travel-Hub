import React, { useState } from 'react';
import type { Metrics, Team } from '../types';

interface TeamComparisonProps {
  metrics: Metrics[];
  teams: Team[];
  seniors: string[];
}

type SortKey = 'name' | 'trips' | 'quotes' | 'passthroughs' | 'tq' | 'tp' | 'pq' | 'hotPass' | 'bookings' | 'nonConverted';

const formatPercent = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
};

export const TeamComparison: React.FC<TeamComparisonProps> = ({ metrics, teams, seniors }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('trips');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Calculate Senior vs Non-Senior data
  const seniorMetrics = metrics.filter(m => seniors.includes(m.agentName));
  const nonSeniorMetrics = metrics.filter(m => !seniors.includes(m.agentName));

  const calculateGroupTotals = (groupMetrics: Metrics[]) => {
    const totals = groupMetrics.reduce(
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
    };
  };

  const seniorData = calculateGroupTotals(seniorMetrics);
  const nonSeniorData = calculateGroupTotals(nonSeniorMetrics);

  const hasSeniors = seniors.length > 0 && seniorMetrics.length > 0;

  if (teams.length < 2 && !hasSeniors) {
    return null;
  }

  const teamData = teams.map((team) => {
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
      }),
      { trips: 0, quotes: 0, passthroughs: 0, hotPasses: 0, bookings: 0, nonConvertedLeads: 0, totalLeads: 0 }
    );

    return {
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
    };
  });

  const sortedTeams = [...teamData].sort((a, b) => {
    const modifier = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'name') {
      return a.name.localeCompare(b.name) * modifier;
    }
    return (a[sortKey] - b[sortKey]) * modifier;
  });

  const maxTrips = Math.max(...teamData.map(t => t.trips));
  const maxQuotes = Math.max(...teamData.map(t => t.quotes));
  const maxPassthroughs = Math.max(...teamData.map(t => t.passthroughs));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const colorClasses: Record<string, { active: string; inactive: string }> = {
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
  };

  const SortButton = ({ label, sortKeyVal, color = 'gray' }: { label: string; sortKeyVal: SortKey; color?: string }) => {
    const classes = colorClasses[color] || colorClasses.gray;
    return (
      <button
        onClick={() => handleSort(sortKeyVal)}
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

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all"
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

      {isOpen && (
        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-sm text-gray-500 mr-2 self-center">Sort by:</span>
            <SortButton label="Name" sortKeyVal="name" />
            <SortButton label="Trips" sortKeyVal="trips" />
            <SortButton label="Quotes" sortKeyVal="quotes" />
            <SortButton label="Passthroughs" sortKeyVal="passthroughs" />
            <SortButton label="T>Q" sortKeyVal="tq" color="blue" />
            <SortButton label="T>P" sortKeyVal="tp" color="green" />
            <SortButton label="P>Q" sortKeyVal="pq" color="purple" />
            <SortButton label="Hot Pass" sortKeyVal="hotPass" color="orange" />
            <SortButton label="Bookings" sortKeyVal="bookings" color="cyan" />
            <SortButton label="% Non-Conv" sortKeyVal="nonConverted" color="rose" />
          </div>

          {/* Team Comparison */}
          {teams.length >= 2 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Team Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedTeams.map((team, idx) => (
                  <div
                    key={team.name}
                    className={`relative p-5 rounded-xl border-2 ${
                      idx === 0 && sortKey !== 'name'
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {idx === 0 && sortKey !== 'name' && (
                      <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
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

                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-6 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-blue-600">{formatPercent(team.tq)}</div>
                        <div className="text-xs text-gray-500">T&gt;Q</div>
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
                        <div className="text-lg font-bold text-orange-600">{formatPercent(team.hotPass)}</div>
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

          {/* Senior vs Non-Senior Comparison */}
          {hasSeniors && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Senior vs Non-Senior Comparison
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seniors Card */}
                <div className="relative p-5 rounded-xl border-2 border-amber-400 bg-amber-50">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <h3 className="text-lg font-bold text-amber-800">Seniors</h3>
                  </div>
                  <p className="text-sm text-amber-600 mb-4">{seniorData.agentCount} agents</p>

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

                  <div className="mt-4 pt-4 border-t border-amber-200 grid grid-cols-6 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{formatPercent(seniorData.tq)}</div>
                      <div className="text-xs text-gray-500">T&gt;Q</div>
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
                      <div className="text-lg font-bold text-orange-600">{formatPercent(seniorData.hotPass)}</div>
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

                  <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-6 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{formatPercent(nonSeniorData.tq)}</div>
                      <div className="text-xs text-gray-500">T&gt;Q</div>
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
                      <div className="text-lg font-bold text-orange-600">{formatPercent(nonSeniorData.hotPass)}</div>
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
      )}
    </div>
  );
};
