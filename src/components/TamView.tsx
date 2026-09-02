import { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import type { CrmParsedData } from '../utils/indexedDB';
import {
  computeTamScorecard,
  computeRevenueAnalytics,
  computeFunnelData,
  computeDestinationPerformance,
  computeTamLeaderboard,
  computeVelocityData,
  computePartnerIntelligence,
  type ScorecardMetrics,
  type TamAgentStats,
  type DestinationPerformance as DestPerf,
  type PartnerStats,
} from '../utils/tamAnalytics';
import { filterCrmDataByDate, getCrmDateExtent } from '../utils/excelParser';
import { DateRangeFilter } from './DateRangeFilter';
import * as XLSX from 'xlsx';

interface TamViewProps {
  crmData: CrmParsedData;
  tams: string[];
}

type SortKey = keyof TamAgentStats;
type DestSortKey = keyof DestPerf;
type PartnerSortKey = 'partnerName' | 'assignedTam' | 'enquiries' | 'passthroughs' | 'quotes' | 'bookings' | 'revenue';

const FALLBACK_GBP_USD = 1.27;

const formatDays = (val: number): string => {
  if (val === 0) return '—';
  return `${val.toFixed(1)}d`;
};

export const TamView: React.FC<TamViewProps> = ({ crmData, tams }) => {
  const { isAudley } = useTheme();
  const [agentFilter, setAgentFilter] = useState<'tams' | 'all'>('tams');
  const [gbpToUsd, setGbpToUsd] = useState(FALLBACK_GBP_USD);
  const [rateSource, setRateSource] = useState<'loading' | 'live' | 'fallback'>('loading');

  useEffect(() => {
    const cached = sessionStorage.getItem('gbp-usd-rate');
    if (cached) {
      const { rate, ts } = JSON.parse(cached);
      // Use cache if less than 1 hour old
      if (Date.now() - ts < 3_600_000) {
        setGbpToUsd(rate);
        setRateSource('live');
        return;
      }
    }
    fetch('https://api.frankfurter.app/latest?from=GBP&to=USD')
      .then(res => res.json())
      .then(data => {
        const rate = data.rates?.USD;
        if (rate && typeof rate === 'number') {
          setGbpToUsd(rate);
          setRateSource('live');
          sessionStorage.setItem('gbp-usd-rate', JSON.stringify({ rate, ts: Date.now() }));
        } else {
          setRateSource('fallback');
        }
      })
      .catch(() => setRateSource('fallback'));
  }, []);

  const formatCurrency = useCallback((val: number): string => {
    const converted = val * gbpToUsd;
    if (converted >= 1_000_000) return `$${(converted / 1_000_000).toFixed(1)}M`;
    if (converted >= 1_000) return `$${(converted / 1_000).toFixed(0)}k`;
    return `$${converted.toFixed(0)}`;
  }, [gbpToUsd]);
  const [leaderboardSort, setLeaderboardSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'bookings', desc: true });
  const [destSort, setDestSort] = useState<{ key: DestSortKey; desc: boolean }>({ key: 'enquiries', desc: true });
  const [partnerSort, setPartnerSort] = useState<{ key: PartnerSortKey; desc: boolean }>({ key: 'enquiries', desc: true });
  const [showStalled, setShowStalled] = useState(false);
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [partnerTamFilter, setPartnerTamFilter] = useState<string>('all');
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<string>('all');

  // Independent date filter state
  const [pendingStartDate, setPendingStartDate] = useState('');
  const [pendingEndDate, setPendingEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const handleApplyDateRange = useCallback(() => {
    setAppliedStartDate(pendingStartDate);
    setAppliedEndDate(pendingEndDate);
  }, [pendingStartDate, pendingEndDate]);

  const handleClearDateRange = useCallback(() => {
    setPendingStartDate('');
    setPendingEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  }, []);

  // Date extent for min/max bounds on the date picker
  const dateExtent = useMemo(() => getCrmDateExtent(crmData), [crmData]);

  // Filtered CRM data based on applied dates
  const filteredCrmData = useMemo(
    () => filterCrmDataByDate(crmData, appliedStartDate, appliedEndDate),
    [crmData, appliedStartDate, appliedEndDate],
  );

  const hasDateFilter = appliedStartDate || appliedEndDate;

  // Compute all analytics using filtered data
  const scorecard = useMemo(() => computeTamScorecard(filteredCrmData, tams), [filteredCrmData, tams]);
  const revenue = useMemo(() => computeRevenueAnalytics(filteredCrmData, tams, agentFilter), [filteredCrmData, tams, agentFilter]);
  const funnel = useMemo(() => computeFunnelData(filteredCrmData, tams, agentFilter), [filteredCrmData, tams, agentFilter]);
  const destinations = useMemo(() => computeDestinationPerformance(filteredCrmData, tams, agentFilter), [filteredCrmData, tams, agentFilter]);
  const leaderboard = useMemo(() => computeTamLeaderboard(filteredCrmData, tams, agentFilter), [filteredCrmData, tams, agentFilter]);
  const velocity = useMemo(() => computeVelocityData(filteredCrmData, tams, agentFilter), [filteredCrmData, tams, agentFilter]);
  const partnerIntel = useMemo(() => computePartnerIntelligence(filteredCrmData, tams, agentFilter), [filteredCrmData, tams, agentFilter]);

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

  // Unique TAM agent names for the partner filter dropdown
  const uniqueTamNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of partnerIntel.partners) {
      if (p.assignedTam) names.add(p.assignedTam);
    }
    return Array.from(names).sort();
  }, [partnerIntel.partners]);

  // Sorted & filtered partners
  const sortedPartners = useMemo(() => {
    const filtered = partnerIntel.partners
      .filter(p => partnerTamFilter === 'all' || p.assignedTam === partnerTamFilter)
      .filter(p => partnerStatusFilter === 'all' || p.funnelStatus === partnerStatusFilter);
    return [...filtered].sort((a, b) => {
      const aVal = a[partnerSort.key as keyof PartnerStats];
      const bVal = b[partnerSort.key as keyof PartnerStats];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return partnerSort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return partnerSort.desc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [partnerIntel.partners, partnerSort, partnerTamFilter, partnerStatusFilter]);

  const handlePartnerSort = (key: PartnerSortKey) => {
    setPartnerSort(prev => ({
      key,
      desc: prev.key === key ? !prev.desc : true,
    }));
  };

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

  const exportPartnersToExcel = useCallback(() => {
    const rows = sortedPartners.map(p => ({
      'Partner Name': p.partnerName,
      'TAM': p.assignedTam,
      'Enquiries': p.enquiries,
      'PT': p.passthroughs,
      'Quotes': p.quotes,
      'Bookings': p.bookings,
      'Revenue (USD)': Math.round(p.revenue * gbpToUsd),
      'Destinations': p.destinations.join(', '),
      'Status': p.funnelStatus,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Partner Intelligence');
    XLSX.writeFile(wb, 'partner-intelligence.xlsx');
  }, [sortedPartners, gbpToUsd]);

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
          <p className={`text-[10px] mt-0.5 ${labelClass}`}>
            GBP → USD @ {gbpToUsd.toFixed(4)}{' '}
            {rateSource === 'live' ? '(ECB live rate)' : rateSource === 'fallback' ? '(fallback rate)' : '(loading...)'}
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

      {/* Date Range Filter */}
      <div className={`flex flex-wrap items-center gap-3 ${isAudley ? 'bg-white border border-[#ede8e0]' : 'bg-slate-800/50 border border-slate-700/50'} rounded-xl px-4 py-3`}>
        <DateRangeFilter
          startDate={pendingStartDate}
          endDate={pendingEndDate}
          onStartDateChange={setPendingStartDate}
          onEndDateChange={setPendingEndDate}
          onClear={handleClearDateRange}
          minDate={dateExtent.min ?? undefined}
          maxDate={dateExtent.max ?? undefined}
        />
        <button
          onClick={handleApplyDateRange}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            isAudley
              ? 'bg-[#4d726d] text-white hover:bg-[#3d5c58] shadow-sm'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          Update
        </button>
        {hasDateFilter && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            isAudley ? 'bg-[#4d726d]/10 text-[#4d726d]' : 'bg-indigo-500/20 text-indigo-300'
          }`}>
            Date filter active
          </span>
        )}
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
                {(showAllDestinations ? sortedDestinations : sortedDestinations.slice(0, 10)).map(d => (
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
          {sortedDestinations.length > 10 && (
            <button
              onClick={() => setShowAllDestinations(!showAllDestinations)}
              className={`mt-3 text-xs font-medium transition-colors ${accentClass} hover:opacity-80`}
            >
              {showAllDestinations ? `Show top 10 only` : `Show all ${sortedDestinations.length} destinations`}
            </button>
          )}
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

      {/* 7. Partner Intelligence */}
      {partnerIntel.totalPartners > 0 && (
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${valueClass}`}>
              <svg className={`w-5 h-5 ${isAudley ? 'text-violet-600' : 'text-violet-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Partner Intelligence
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              {uniqueTamNames.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <label className={`text-xs font-medium ${labelClass}`}>TAM:</label>
                  <select
                    value={partnerTamFilter}
                    onChange={(e) => setPartnerTamFilter(e.target.value)}
                    className={`px-2 py-1.5 text-sm rounded-lg border transition-colors ${
                      isAudley
                        ? 'border-[#ede8e0] bg-white text-[#0a1628] focus:border-[#4d726d] focus:ring-1 focus:ring-[#4d726d]'
                        : 'border-slate-600 bg-slate-700/50 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                    }`}
                  >
                    <option value="all">All TAMs</option>
                    {uniqueTamNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <label className={`text-xs font-medium ${labelClass}`}>Status:</label>
                <div className="relative group">
                  <svg className={`w-3.5 h-3.5 cursor-help ${isAudley ? 'text-[#7a7a7a]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg shadow-lg text-xs leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 ${
                    isAudley ? 'bg-white border border-[#ede8e0] text-[#0a1628]' : 'bg-slate-700 border border-slate-600 text-slate-200'
                  }`}>
                    <div className="font-semibold mb-1.5">Partner Status</div>
                    <div className="space-y-1">
                      <div><span className="font-medium text-emerald-500">Booked</span> — Has confirmed bookings</div>
                      <div><span className="font-medium text-blue-500">Quoting</span> — Quotes sent, no bookings yet</div>
                      <div><span className="font-medium text-amber-500">Progressing</span> — Passthroughs made, not yet quoting</div>
                      <div><span className="font-medium text-red-500">Stalled</span> — Enquiries only, nothing progressed</div>
                    </div>
                  </div>
                </div>
                <select
                  value={partnerStatusFilter}
                  onChange={(e) => setPartnerStatusFilter(e.target.value)}
                  className={`px-2 py-1.5 text-sm rounded-lg border transition-colors ${
                    isAudley
                      ? 'border-[#ede8e0] bg-white text-[#0a1628] focus:border-[#4d726d] focus:ring-1 focus:ring-[#4d726d]'
                      : 'border-slate-600 bg-slate-700/50 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                  }`}
                >
                  <option value="all">All Statuses</option>
                  <option value="booked">Booked</option>
                  <option value="quoting">Quoting</option>
                  <option value="progressing">Progressing</option>
                  <option value="stalled">Stalled</option>
                </select>
              </div>
              <button
                onClick={exportPartnersToExcel}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  isAudley
                    ? 'border-[#4d726d] text-[#4d726d] hover:bg-[#4d726d] hover:text-white'
                    : 'border-indigo-500 text-indigo-400 hover:bg-indigo-500 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* a) Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className={highlightCardClass}>
              <div className={`text-xs ${labelClass}`}>Total Partners</div>
              <div className={`text-2xl font-bold ${accentClass}`}>{partnerIntel.totalPartners}</div>
            </div>
            <div className={statCardClass}>
              <div className={`text-xs ${labelClass}`}>Active Partners</div>
              <div className={`text-2xl font-bold ${valueClass}`}>{partnerIntel.activePartners}</div>
            </div>
            <div className={statCardClass}>
              <div className={`text-xs ${labelClass}`}>Stalled Partners</div>
              <div className={`text-2xl font-bold ${isAudley ? 'text-red-600' : 'text-red-400'}`}>{partnerIntel.stalledPartners}</div>
            </div>
            <div className={statCardClass}>
              <div className={`text-xs ${labelClass}`}>Partners with Bookings</div>
              <div className={`text-2xl font-bold ${isAudley ? 'text-emerald-600' : 'text-emerald-400'}`}>{partnerIntel.bookedPartners}</div>
            </div>
          </div>

          {/* b) Top Partners table */}
          <div className="mb-6">
            <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${labelClass}`}>Partners ({sortedPartners.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isAudley ? 'border-[#ede8e0]' : 'border-slate-700'}`}>
                    {[
                      { key: 'partnerName' as PartnerSortKey, label: 'Partner Name' },
                      { key: 'assignedTam' as PartnerSortKey, label: 'TAM' },
                      { key: 'enquiries' as PartnerSortKey, label: 'Enq' },
                      { key: 'passthroughs' as PartnerSortKey, label: 'PT' },
                      { key: 'quotes' as PartnerSortKey, label: 'Qt' },
                      { key: 'bookings' as PartnerSortKey, label: 'Bk' },
                      { key: 'revenue' as PartnerSortKey, label: 'Revenue' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => handlePartnerSort(col.key)}
                        className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider cursor-pointer text-left ${labelClass} hover:opacity-80`}
                      >
                        {col.label}{sortArrow(col.key, partnerSort)}
                      </th>
                    ))}
                    <th className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider text-left ${labelClass}`}>Destinations</th>
                    <th className={`py-2 px-2 text-xs font-semibold uppercase tracking-wider text-left ${labelClass}`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPartners.map(p => {
                    const statusColors: Record<PartnerStats['funnelStatus'], string> = {
                      booked: isAudley ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400',
                      quoting: isAudley ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400',
                      progressing: isAudley ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400',
                      stalled: isAudley ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400',
                    };
                    return (
                      <tr key={p.partnerName} className={`border-b ${isAudley ? 'border-[#ede8e0]/50' : 'border-slate-700/50'}`}>
                        <td className={`py-2 px-2 font-medium ${valueClass}`}>{p.partnerName}</td>
                        <td className={`py-2 px-2 ${labelClass}`}>{p.assignedTam}</td>
                        <td className={`py-2 px-2 ${valueClass}`}>{p.enquiries}</td>
                        <td className={`py-2 px-2 ${valueClass}`}>{p.passthroughs}</td>
                        <td className={`py-2 px-2 ${valueClass}`}>{p.quotes}</td>
                        <td className={`py-2 px-2 font-semibold ${valueClass}`}>{p.bookings}</td>
                        <td className={`py-2 px-2 ${valueClass}`}>{formatCurrency(p.revenue)}</td>
                        <td className={`py-2 px-2 ${labelClass} text-xs`}>{p.destinations.join(', ')}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusColors[p.funnelStatus]}`}>
                            {p.funnelStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* c) Stalled Partners (collapsible) */}
          {partnerIntel.stalledList.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowStalled(!showStalled)}
                className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-3 ${accentClass} hover:opacity-80`}
              >
                <svg className={`w-4 h-4 transition-transform ${showStalled ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Stalled Partners ({partnerIntel.stalledList.length})
              </button>
              {showStalled && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {partnerIntel.stalledList.map(p => (
                    <div key={p.partnerName} className={`flex items-center justify-between ${statCardClass}`}>
                      <div>
                        <div className={`text-sm font-medium ${valueClass}`}>{p.partnerName}</div>
                        <div className={`text-[10px] ${labelClass}`}>{p.assignedTam} · {p.destinations.join(', ') || 'No destination'}</div>
                      </div>
                      <div className={`text-sm font-bold ${isAudley ? 'text-red-600' : 'text-red-400'}`}>
                        {p.enquiries} enq
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* d) TAM Portfolio Concentration */}
          {partnerIntel.concentration.length > 0 && (
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${labelClass}`}>TAM Portfolio Concentration</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {partnerIntel.concentration.map(c => (
                  <div key={c.tamName} className={statCardClass}>
                    <div className={`text-xs font-medium truncate ${valueClass}`}>{c.tamName}</div>
                    <div className={`text-sm font-bold ${accentClass}`}>{c.partnerCount} partners</div>
                    <div className={`text-[10px] ${labelClass}`}>
                      {c.totalEnquiries} enq · {c.totalBookings} bk · {formatCurrency(c.totalRevenue)}
                    </div>
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
