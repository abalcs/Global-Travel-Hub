import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import type { CrmParsedData } from '../utils/indexedDB';
import type { Metrics } from '../types';
import {
  computeTamScorecard,
  computeRevenueAnalytics,
  computeFunnelData,
  computeDestinationPerformance,
  computeTamLeaderboard,
  computeVelocityData,
  type ScorecardMetrics,
  type TamAgentStats,
  type DestinationPerformance as DestPerf,
} from '../utils/tamAnalytics';

interface TamViewProps {
  crmData: CrmParsedData;
  tams: string[];
  metrics: Metrics[];
}

type SortKey = keyof TamAgentStats;
type DestSortKey = keyof DestPerf;

const formatCurrency = (val: number): string => {
  if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}k`;
  return `£${val.toFixed(0)}`;
};

const formatDays = (val: number): string => {
  if (val === 0) return '—';
  return `${val.toFixed(1)}d`;
};

export const TamView: React.FC<TamViewProps> = ({ crmData, tams }) => {
  const { isAudley } = useTheme();
  const [agentFilter, setAgentFilter] = useState<'tams' | 'all'>('tams');
  const [leaderboardSort, setLeaderboardSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'bookings', desc: true });
  const [destSort, setDestSort] = useState<{ key: DestSortKey; desc: boolean }>({ key: 'enquiries', desc: true });

  // Compute all analytics
  const scorecard = useMemo(() => computeTamScorecard(crmData, tams), [crmData, tams]);
  const revenue = useMemo(() => computeRevenueAnalytics(crmData, tams, agentFilter), [crmData, tams, agentFilter]);
  const funnel = useMemo(() => computeFunnelData(crmData, tams, agentFilter), [crmData, tams, agentFilter]);
  const destinations = useMemo(() => computeDestinationPerformance(crmData, tams, agentFilter), [crmData, tams, agentFilter]);
  const leaderboard = useMemo(() => computeTamLeaderboard(crmData, tams, agentFilter), [crmData, tams, agentFilter]);
  const velocity = useMemo(() => computeVelocityData(crmData, tams, agentFilter), [crmData, tams, agentFilter]);

  // Sorted leaderboard
  const sortedLeaderboard = useMemo(() => {
    const sorted = [...leaderboard].sort((a, b) => {
      const aVal = a[leaderboardSort.key] as number;
      const bVal = b[leaderboardSort.key] as number;
      return leaderboardSort.desc ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [leaderboard, leaderboardSort]);

  // Sorted destinations
  const sortedDestinations = useMemo(() => {
    const sorted = [...destinations].sort((a, b) => {
      const aVal = a[destSort.key] as number;
      const bVal = b[destSort.key] as number;
      return destSort.desc ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [destinations, destSort]);

  const handleLeaderboardSort = (key: SortKey) => {
    setLeaderboardSort(prev => ({
      key,
      desc: prev.key === key ? !prev.desc : true,
    }));
  };

  const handleDestSort = (key: DestSortKey) => {
    setDestSort(prev => ({
      key,
      desc: prev.key === key ? !prev.desc : true,
    }));
  };

  // Empty state
  if (tams.length === 0) {
    return (
      <div className={`text-center py-16 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-lg font-medium mb-2">No TAM agents configured</p>
        <p className="text-sm">Add TAM agent names in the Configuration panel to see B2B analytics.</p>
      </div>
    );
  }

  const hasB2BData = funnel.stages[0]?.count > 0;
  if (!hasB2BData) {
    return (
      <div className={`text-center py-16 ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`}>
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p className="text-lg font-medium mb-2">No B2B data found</p>
        <p className="text-sm">Upload CRM reports containing B2B channel data to see TAM analytics.</p>
      </div>
    );
  }

  // Card styling helpers
  const cardClass = isAudley
    ? 'bg-white border-[#ede8e0] rounded-2xl p-6 border'
    : 'bg-slate-800/50 border-slate-700/50 rounded-2xl p-6 border backdrop-blur';
  const statCardClass = isAudley
    ? 'bg-[#faf8f5] border-[#ede8e0] rounded-lg p-4 border'
    : 'bg-slate-700/30 border-slate-600/30 rounded-lg p-4 border';
  const highlightCardClass = isAudley
    ? 'bg-gradient-to-br from-[#e8f0ee] to-[#f0f5f4] border-[#4d726d]/20 rounded-lg p-4 border'
    : 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/30 rounded-lg p-4 border';
  const labelClass = isAudley ? 'text-[#7a7a7a]' : 'text-slate-400';
  const valueClass = isAudley ? 'text-[#0a1628]' : 'text-white';
  const accentClass = isAudley ? 'text-[#4d726d]' : 'text-indigo-400';
  const accentColor = isAudley ? '#4d726d' : '#818cf8';
  const secondaryColor = isAudley ? '#c4956a' : '#a78bfa';

  const renderScorecardSide = (label: string, m: ScorecardMetrics, accent: boolean) => (
    <div className={accent ? highlightCardClass : statCardClass}>
      <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${accent ? accentClass : labelClass}`}>
        {label}
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Enquiries', val: m.enquiries },
          { label: 'Passthroughs', val: m.passthroughs },
          { label: 'Quotes', val: m.quotes },
          { label: 'Bookings', val: m.bookings },
        ].map(item => (
          <div key={item.label} className="text-center">
            <div className={`text-lg font-bold ${valueClass}`}>{item.val.toLocaleString()}</div>
            <div className={`text-[10px] ${labelClass}`}>{item.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'E>P', val: m.epRate },
          { label: 'E>Q', val: m.eqRate },
          { label: 'P>Q', val: m.pqRate },
          { label: 'E>B', val: m.ebRate },
        ].map(item => (
          <div key={item.label} className="text-center">
            <div className={`text-sm font-semibold ${accent ? accentClass : valueClass}`}>{item.val.toFixed(1)}%</div>
            <div className={`text-[10px] ${labelClass}`}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // Sort indicator
  const sortArrow = (key: string, current: { key: string; desc: boolean }) =>
    current.key === key ? (current.desc ? ' ↓' : ' ↑') : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className={`text-xl font-semibold flex items-center gap-2 ${isAudley ? 'text-[#0a1628]' : 'text-white'}`}>
            <svg className={`w-6 h-6 ${isAudley ? 'text-[#0a1628]' : 'text-cyan-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            TAM Analytics
          </h2>
          <p className={`text-sm mt-1 ${labelClass}`}>
            B2B trade account performance and revenue analytics
          </p>
        </div>
        {/* Scope toggle */}
        <div className={`flex items-center rounded-lg border ${isAudley ? 'border-[#ede8e0]' : 'border-slate-600'}`}>
          <button
            onClick={() => setAgentFilter('tams')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-colors rounded-l-lg ${
              agentFilter === 'tams'
                ? isAudley
                  ? 'bg-[#4d726d] text-white'
                  : 'bg-indigo-600 text-white'
                : isAudley
                  ? 'text-[#7a7a7a] hover:bg-[#faf8f5]'
                  : 'text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            TAM Only
          </button>
          <button
            onClick={() => setAgentFilter('all')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-colors rounded-r-lg ${
              agentFilter === 'all'
                ? isAudley
                  ? 'bg-[#4d726d] text-white'
                  : 'bg-indigo-600 text-white'
                : isAudley
                  ? 'text-[#7a7a7a] hover:bg-[#faf8f5]'
                  : 'text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            All B2B
          </button>
        </div>
      </div>

      {/* 1. TAM Scorecard */}
      <div className={cardClass}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${valueClass}`}>
          <svg className={`w-5 h-5 ${accentClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          B2B Scorecard
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderScorecardSide('TAM Agents', scorecard.tam, true)}
          {renderScorecardSide('Non-TAM B2B', scorecard.nonTam, false)}
        </div>
      </div>

      {/* 2. Revenue Analytics */}
      <div className={cardClass}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${valueClass}`}>
          <svg className={`w-5 h-5 ${isAudley ? 'text-emerald-600' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          B2B Revenue
        </h3>
        {/* Revenue summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className={highlightCardClass}>
            <div className={`text-xs ${labelClass}`}>Total Revenue</div>
            <div className={`text-2xl font-bold ${accentClass}`}>{formatCurrency(revenue.totalRevenue)}</div>
          </div>
          <div className={statCardClass}>
            <div className={`text-xs ${labelClass}`}>Avg Deal Value</div>
            <div className={`text-2xl font-bold ${valueClass}`}>{formatCurrency(revenue.avgDealValue)}</div>
          </div>
          <div className={statCardClass}>
            <div className={`text-xs ${labelClass}`}>Total Deals</div>
            <div className={`text-2xl font-bold ${valueClass}`}>{revenue.totalDeals.toLocaleString()}</div>
          </div>
        </div>
        {/* Revenue by agent chart */}
        {revenue.byAgent.length > 0 && (
          <div>
            <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${labelClass}`}>Revenue by Agent</div>
            <div style={{ height: Math.max(200, revenue.byAgent.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue.byAgent} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: isAudley ? '#7a7a7a' : '#94a3b8' }} />
                  <YAxis
                    type="category"
                    dataKey="agentName"
                    width={120}
                    tick={{ fontSize: 11, fill: isAudley ? '#0a1628' : '#e2e8f0' }}
                    tickFormatter={(name: string) => name.length > 16 ? name.slice(0, 14) + '...' : name}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                    contentStyle={{
                      backgroundColor: isAudley ? '#fff' : '#1e293b',
                      border: `1px solid ${isAudley ? '#ede8e0' : '#334155'}`,
                      borderRadius: '8px',
                      color: isAudley ? '#0a1628' : '#e2e8f0',
                    }}
                  />
                  <Bar dataKey="totalRevenue" radius={[0, 4, 4, 0]} barSize={20}>
                    {revenue.byAgent.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? accentColor : secondaryColor} fillOpacity={1 - (i * 0.06)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {/* Top revenue destinations */}
        {revenue.topDestinations.length > 0 && (
          <div className="mt-6">
            <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${labelClass}`}>Top Revenue Destinations</div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              {revenue.topDestinations.slice(0, 5).map((d) => (
                <div key={d.destination} className={statCardClass}>
                  <div className={`text-xs truncate ${labelClass}`}>{d.destination}</div>
                  <div className={`text-sm font-bold ${valueClass}`}>{formatCurrency(d.totalRevenue)}</div>
                  <div className={`text-[10px] ${labelClass}`}>{d.dealCount} deals</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Conversion Funnel */}
      <div className={cardClass}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${valueClass}`}>
          <svg className={`w-5 h-5 ${isAudley ? 'text-blue-600' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          B2B Conversion Funnel
        </h3>
        <div className="space-y-3">
          {funnel.stages.map((stage, i) => {
            const maxCount = funnel.stages[0].count || 1;
            const widthPct = Math.max(8, (stage.count / maxCount) * 100);
            const colors = [
              { bg: isAudley ? 'bg-[#4d726d]' : 'bg-indigo-500', text: 'text-white' },
              { bg: isAudley ? 'bg-[#5d8a84]' : 'bg-indigo-400', text: 'text-white' },
              { bg: isAudley ? 'bg-[#c4956a]' : 'bg-purple-400', text: 'text-white' },
              { bg: isAudley ? 'bg-emerald-500' : 'bg-emerald-400', text: 'text-white' },
            ];
            const color = colors[i] || colors[0];

            return (
              <div key={stage.stage}>
                <div className="flex items-center gap-3">
                  <div className={`w-28 text-xs font-medium ${labelClass}`}>{stage.stage}</div>
                  <div className="flex-1 relative">
                    <div
                      className={`${color.bg} ${color.text} rounded-lg py-2 px-3 text-sm font-bold transition-all`}
                      style={{ width: `${widthPct}%`, minWidth: '60px' }}
                    >
                      {stage.count.toLocaleString()}
                    </div>
                  </div>
                  <div className={`w-20 text-right text-xs ${labelClass}`}>
                    {i > 0 && (
                      <>
                        <span className={`font-semibold ${accentClass}`}>{stage.conversionFromPrevious.toFixed(1)}%</span>
                        <span className="block text-[10px]">-{stage.dropOff}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Destination Performance */}
      {sortedDestinations.length > 0 && (
        <div className={cardClass}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${valueClass}`}>
            <svg className={`w-5 h-5 ${isAudley ? 'text-amber-600' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Destination Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isAudley ? 'border-[#ede8e0]' : 'border-slate-700'}`}>
                  {[
                    { key: 'destination' as DestSortKey, label: 'Destination' },
                    { key: 'enquiries' as DestSortKey, label: 'Enq' },
                    { key: 'passthroughs' as DestSortKey, label: 'PT' },
                    { key: 'quotes' as DestSortKey, label: 'Qt' },
                    { key: 'bookings' as DestSortKey, label: 'Bk' },
                    { key: 'revenue' as DestSortKey, label: 'Revenue' },
                    { key: 'epRate' as DestSortKey, label: 'E>P' },
                    { key: 'ebRate' as DestSortKey, label: 'E>B' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleDestSort(col.key)}
                      className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider cursor-pointer text-left ${labelClass} hover:opacity-80`}
                    >
                      {col.label}{sortArrow(col.key, destSort)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDestinations.slice(0, 20).map(d => (
                  <tr key={d.destination} className={`border-b ${isAudley ? 'border-[#ede8e0]/50' : 'border-slate-700/50'} hover:${isAudley ? 'bg-[#faf8f5]' : 'bg-slate-700/20'}`}>
                    <td className={`py-2 px-2 font-medium ${valueClass}`}>{d.destination}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{d.enquiries}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{d.passthroughs}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{d.quotes}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{d.bookings}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{formatCurrency(d.revenue)}</td>
                    <td className={`py-2 px-2 ${accentClass}`}>{d.epRate.toFixed(1)}%</td>
                    <td className={`py-2 px-2 ${accentClass}`}>{d.ebRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAM Agent Leaderboard */}
      {sortedLeaderboard.length > 0 && (
        <div className={cardClass}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${valueClass}`}>
            <svg className={`w-5 h-5 ${isAudley ? 'text-yellow-600' : 'text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            {agentFilter === 'tams' ? 'TAM' : 'B2B'} Agent Leaderboard
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isAudley ? 'border-[#ede8e0]' : 'border-slate-700'}`}>
                  {[
                    { key: 'agentName' as SortKey, label: 'Agent' },
                    { key: 'enquiries' as SortKey, label: 'Enq' },
                    { key: 'passthroughs' as SortKey, label: 'PT' },
                    { key: 'quotes' as SortKey, label: 'Qt' },
                    { key: 'bookings' as SortKey, label: 'Bk' },
                    { key: 'revenue' as SortKey, label: 'Revenue' },
                    { key: 'avgDealValue' as SortKey, label: 'Avg Deal' },
                    { key: 'avgCycleTime' as SortKey, label: 'Cycle' },
                    { key: 'epRate' as SortKey, label: 'E>P' },
                    { key: 'pqRate' as SortKey, label: 'P>Q' },
                    { key: 'ebRate' as SortKey, label: 'E>B' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleLeaderboardSort(col.key)}
                      className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider cursor-pointer text-left ${labelClass} hover:opacity-80`}
                    >
                      {col.label}{sortArrow(col.key, leaderboardSort)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.map((a, i) => (
                  <tr key={a.agentName} className={`border-b ${isAudley ? 'border-[#ede8e0]/50' : 'border-slate-700/50'} hover:${isAudley ? 'bg-[#faf8f5]' : 'bg-slate-700/20'}`}>
                    <td className={`py-2 px-2 font-medium ${valueClass}`}>
                      {i < 3 && leaderboardSort.key === 'bookings' && leaderboardSort.desc && (
                        <span className="mr-1">{['🥇', '🥈', '🥉'][i]}</span>
                      )}
                      {a.agentName}
                    </td>
                    <td className={`py-2 px-2 ${valueClass}`}>{a.enquiries}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{a.passthroughs}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{a.quotes}</td>
                    <td className={`py-2 px-2 font-semibold ${valueClass}`}>{a.bookings}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{formatCurrency(a.revenue)}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{formatCurrency(a.avgDealValue)}</td>
                    <td className={`py-2 px-2 ${valueClass}`}>{formatDays(a.avgCycleTime)}</td>
                    <td className={`py-2 px-2 ${accentClass}`}>{a.epRate.toFixed(1)}%</td>
                    <td className={`py-2 px-2 ${accentClass}`}>{a.pqRate.toFixed(1)}%</td>
                    <td className={`py-2 px-2 ${accentClass}`}>{a.ebRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Deal Velocity */}
      {velocity.totalDeals > 0 && (
        <div className={cardClass}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${valueClass}`}>
            <svg className={`w-5 h-5 ${isAudley ? 'text-red-600' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Deal Velocity
          </h3>
          {/* Overall metric */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className={highlightCardClass}>
              <div className={`text-xs ${labelClass}`}>Avg Cycle Time</div>
              <div className={`text-2xl font-bold ${accentClass}`}>{formatDays(velocity.overallAvgCycleTime)}</div>
            </div>
            <div className={statCardClass}>
              <div className={`text-xs ${labelClass}`}>Deals with Timing Data</div>
              <div className={`text-2xl font-bold ${valueClass}`}>{velocity.totalDeals}</div>
            </div>
          </div>
          {/* By agent */}
          {velocity.byAgent.length > 0 && (
            <div className="mb-6">
              <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${labelClass}`}>By Agent (Fastest First)</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {velocity.byAgent.slice(0, 8).map((a) => (
                  <div key={a.agentName} className={statCardClass}>
                    <div className={`text-xs truncate ${labelClass}`}>{a.agentName}</div>
                    <div className={`text-sm font-bold ${valueClass}`}>{formatDays(a.avgCycleTime)}</div>
                    <div className={`text-[10px] ${labelClass}`}>{a.dealCount} deals</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* By destination */}
          {velocity.byDestination.length > 0 && (
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${labelClass}`}>By Destination (Fastest First)</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {velocity.byDestination.slice(0, 8).map((d) => (
                  <div key={d.destination} className={statCardClass}>
                    <div className={`text-xs truncate ${labelClass}`}>{d.destination}</div>
                    <div className={`text-sm font-bold ${valueClass}`}>{formatDays(d.avgCycleTime)}</div>
                    <div className={`text-[10px] ${labelClass}`}>{d.dealCount} deals</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
