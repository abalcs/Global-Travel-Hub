/**
 * TAM (Trade Account Manager) analytics functions.
 *
 * All functions operate on raw CrmRow[] arrays and filter for B2B rows
 * (channel ending with 'B2B'). An optional agentFilter controls whether
 * to show only TAM agents or all B2B data.
 */
import type { CrmRow } from './excelParser';
import type { CrmParsedData } from './indexedDB';

// ── Helpers ──────────────────────────────────────────────────────────

function isB2B(row: CrmRow): boolean {
  return row.channel.endsWith('B2B');
}

function filterRows(
  rows: CrmRow[],
  tams: string[],
  agentFilter: 'tams' | 'all',
): CrmRow[] {
  const b2b = rows.filter(isB2B);
  if (agentFilter === 'all') return b2b;
  const tamSet = new Set(tams.map(t => t.toLowerCase()));
  return b2b.filter(r => tamSet.has(r.agentName.toLowerCase()));
}

// ── 1. TAM Scorecard ─────────────────────────────────────────────────

export interface ScorecardMetrics {
  enquiries: number;
  passthroughs: number;
  quotes: number;
  bookings: number;
  epRate: number;
  eqRate: number;
  pqRate: number;
  ebRate: number;
}

export interface TamScorecardData {
  tam: ScorecardMetrics;
  nonTam: ScorecardMetrics;
}

function buildScorecardMetrics(
  enq: CrmRow[],
  pt: CrmRow[],
  qt: CrmRow[],
  bk: CrmRow[],
): ScorecardMetrics {
  const enquiries = enq.length;
  const passthroughs = pt.length;
  const quotes = qt.length;
  const bookings = bk.length;
  return {
    enquiries,
    passthroughs,
    quotes,
    bookings,
    epRate: enquiries > 0 ? (passthroughs / enquiries) * 100 : 0,
    eqRate: enquiries > 0 ? (quotes / enquiries) * 100 : 0,
    pqRate: passthroughs > 0 ? (quotes / passthroughs) * 100 : 0,
    ebRate: enquiries > 0 ? (bookings / enquiries) * 100 : 0,
  };
}

export function computeTamScorecard(
  data: CrmParsedData,
  tams: string[],
): TamScorecardData {
  const tamSet = new Set(tams.map(t => t.toLowerCase()));

  const tamEnq = data.enquiries.filter(isB2B).filter(r => tamSet.has(r.agentName.toLowerCase()));
  const tamPt = data.passthroughs.filter(isB2B).filter(r => tamSet.has(r.agentName.toLowerCase()));
  const tamQt = data.quotes.filter(isB2B).filter(r => tamSet.has(r.agentName.toLowerCase()) && r.tripRef.trim());
  const tamBk = data.bookings.filter(isB2B).filter(r => tamSet.has(r.agentName.toLowerCase()));

  const nonTamEnq = data.enquiries.filter(isB2B).filter(r => !tamSet.has(r.agentName.toLowerCase()));
  const nonTamPt = data.passthroughs.filter(isB2B).filter(r => !tamSet.has(r.agentName.toLowerCase()));
  const nonTamQt = data.quotes.filter(isB2B).filter(r => !tamSet.has(r.agentName.toLowerCase()) && r.tripRef.trim());
  const nonTamBk = data.bookings.filter(isB2B).filter(r => !tamSet.has(r.agentName.toLowerCase()));

  return {
    tam: buildScorecardMetrics(tamEnq, tamPt, tamQt, tamBk),
    nonTam: buildScorecardMetrics(nonTamEnq, nonTamPt, nonTamQt, nonTamBk),
  };
}

// ── 2. Revenue Analytics ─────────────────────────────────────────────

export interface AgentRevenue {
  agentName: string;
  totalRevenue: number;
  dealCount: number;
  avgDealValue: number;
}

export interface DestinationRevenue {
  destination: string;
  totalRevenue: number;
  dealCount: number;
}

export interface RevenueAnalyticsData {
  totalRevenue: number;
  avgDealValue: number;
  totalDeals: number;
  byAgent: AgentRevenue[];
  topDestinations: DestinationRevenue[];
}

export function computeRevenueAnalytics(
  data: CrmParsedData,
  tams: string[],
  agentFilter: 'tams' | 'all' = 'tams',
): RevenueAnalyticsData {
  // Revenue comes from bookings (realized revenue)
  const rows = filterRows(data.bookings, tams, agentFilter).filter(r => r.totalAmountBCY > 0);

  const totalRevenue = rows.reduce((sum, r) => sum + r.totalAmountBCY, 0);
  const totalDeals = rows.length;
  const avgDealValue = totalDeals > 0 ? totalRevenue / totalDeals : 0;

  // By agent
  const agentMap = new Map<string, { revenue: number; count: number }>();
  for (const r of rows) {
    const entry = agentMap.get(r.agentName) || { revenue: 0, count: 0 };
    entry.revenue += r.totalAmountBCY;
    entry.count++;
    agentMap.set(r.agentName, entry);
  }
  const byAgent: AgentRevenue[] = Array.from(agentMap.entries())
    .map(([agentName, { revenue, count }]) => ({
      agentName,
      totalRevenue: revenue,
      dealCount: count,
      avgDealValue: count > 0 ? revenue / count : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // By destination
  const destMap = new Map<string, { revenue: number; count: number }>();
  for (const r of rows) {
    const dest = r.destination || 'Unknown';
    const entry = destMap.get(dest) || { revenue: 0, count: 0 };
    entry.revenue += r.totalAmountBCY;
    entry.count++;
    destMap.set(dest, entry);
  }
  const topDestinations: DestinationRevenue[] = Array.from(destMap.entries())
    .map(([destination, { revenue, count }]) => ({
      destination,
      totalRevenue: revenue,
      dealCount: count,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  return { totalRevenue, avgDealValue, totalDeals, byAgent, topDestinations };
}

// ── 3. Conversion Funnel ─────────────────────────────────────────────

export interface FunnelStage {
  stage: string;
  count: number;
  conversionFromPrevious: number; // % from previous stage
  dropOff: number; // count dropped from previous stage
}

export interface FunnelData {
  stages: FunnelStage[];
}

export function computeFunnelData(
  data: CrmParsedData,
  tams: string[],
  agentFilter: 'tams' | 'all' = 'tams',
): FunnelData {
  const enqCount = filterRows(data.enquiries, tams, agentFilter).length;
  const ptCount = filterRows(data.passthroughs, tams, agentFilter).length;
  const qtCount = filterRows(data.quotes, tams, agentFilter).filter(r => r.tripRef.trim()).length;
  const bkCount = filterRows(data.bookings, tams, agentFilter).length;

  const stages: FunnelStage[] = [
    {
      stage: 'Enquiries',
      count: enqCount,
      conversionFromPrevious: 100,
      dropOff: 0,
    },
    {
      stage: 'Passthroughs',
      count: ptCount,
      conversionFromPrevious: enqCount > 0 ? (ptCount / enqCount) * 100 : 0,
      dropOff: enqCount - ptCount,
    },
    {
      stage: 'Quotes',
      count: qtCount,
      conversionFromPrevious: ptCount > 0 ? (qtCount / ptCount) * 100 : 0,
      dropOff: ptCount - qtCount,
    },
    {
      stage: 'Bookings',
      count: bkCount,
      conversionFromPrevious: qtCount > 0 ? (bkCount / qtCount) * 100 : 0,
      dropOff: qtCount - bkCount,
    },
  ];

  return { stages };
}

// ── 4. Destination Performance ───────────────────────────────────────

export interface DestinationPerformance {
  destination: string;
  enquiries: number;
  passthroughs: number;
  quotes: number;
  bookings: number;
  revenue: number;
  epRate: number;
  ebRate: number;
}

export function computeDestinationPerformance(
  data: CrmParsedData,
  tams: string[],
  agentFilter: 'tams' | 'all' = 'tams',
): DestinationPerformance[] {
  const enqRows = filterRows(data.enquiries, tams, agentFilter);
  const ptRows = filterRows(data.passthroughs, tams, agentFilter);
  const qtRows = filterRows(data.quotes, tams, agentFilter).filter(r => r.tripRef.trim());
  const bkRows = filterRows(data.bookings, tams, agentFilter);

  const destMap = new Map<string, {
    enquiries: number;
    passthroughs: number;
    quotes: number;
    bookings: number;
    revenue: number;
  }>();

  const ensure = (dest: string) => {
    const key = dest || 'Unknown';
    if (!destMap.has(key)) destMap.set(key, { enquiries: 0, passthroughs: 0, quotes: 0, bookings: 0, revenue: 0 });
    return destMap.get(key)!;
  };

  for (const r of enqRows) ensure(r.destination).enquiries++;
  for (const r of ptRows) ensure(r.destination).passthroughs++;
  for (const r of qtRows) ensure(r.destination).quotes++;
  for (const r of bkRows) {
    const entry = ensure(r.destination);
    entry.bookings++;
    entry.revenue += r.totalAmountBCY;
  }

  return Array.from(destMap.entries())
    .map(([destination, d]) => ({
      destination,
      ...d,
      epRate: d.enquiries > 0 ? (d.passthroughs / d.enquiries) * 100 : 0,
      ebRate: d.enquiries > 0 ? (d.bookings / d.enquiries) * 100 : 0,
    }))
    .sort((a, b) => b.enquiries - a.enquiries);
}

// ── 5. TAM Agent Leaderboard ─────────────────────────────────────────

export interface TamAgentStats {
  agentName: string;
  enquiries: number;
  passthroughs: number;
  quotes: number;
  bookings: number;
  revenue: number;
  avgDealValue: number;
  avgCycleTime: number;
  epRate: number;
  eqRate: number;
  pqRate: number;
  ebRate: number;
}

export function computeTamLeaderboard(
  data: CrmParsedData,
  tams: string[],
  agentFilter: 'tams' | 'all' = 'tams',
): TamAgentStats[] {
  const enqRows = filterRows(data.enquiries, tams, agentFilter);
  const ptRows = filterRows(data.passthroughs, tams, agentFilter);
  const qtRows = filterRows(data.quotes, tams, agentFilter).filter(r => r.tripRef.trim());
  const bkRows = filterRows(data.bookings, tams, agentFilter);

  const agentMap = new Map<string, {
    enquiries: number;
    passthroughs: number;
    quotes: number;
    bookings: number;
    revenue: number;
    totalCycleTime: number;
    cycleTimeCount: number;
  }>();

  const ensure = (name: string) => {
    if (!agentMap.has(name)) agentMap.set(name, {
      enquiries: 0, passthroughs: 0, quotes: 0, bookings: 0,
      revenue: 0, totalCycleTime: 0, cycleTimeCount: 0,
    });
    return agentMap.get(name)!;
  };

  for (const r of enqRows) ensure(r.agentName).enquiries++;
  for (const r of ptRows) ensure(r.agentName).passthroughs++;
  for (const r of qtRows) ensure(r.agentName).quotes++;
  for (const r of bkRows) {
    const entry = ensure(r.agentName);
    entry.bookings++;
    entry.revenue += r.totalAmountBCY;
    if (r.timeTaken > 0) {
      entry.totalCycleTime += r.timeTaken;
      entry.cycleTimeCount++;
    }
  }

  return Array.from(agentMap.entries())
    .map(([agentName, a]) => ({
      agentName,
      enquiries: a.enquiries,
      passthroughs: a.passthroughs,
      quotes: a.quotes,
      bookings: a.bookings,
      revenue: a.revenue,
      avgDealValue: a.bookings > 0 ? a.revenue / a.bookings : 0,
      avgCycleTime: a.cycleTimeCount > 0 ? a.totalCycleTime / a.cycleTimeCount : 0,
      epRate: a.enquiries > 0 ? (a.passthroughs / a.enquiries) * 100 : 0,
      eqRate: a.enquiries > 0 ? (a.quotes / a.enquiries) * 100 : 0,
      pqRate: a.passthroughs > 0 ? (a.quotes / a.passthroughs) * 100 : 0,
      ebRate: a.enquiries > 0 ? (a.bookings / a.enquiries) * 100 : 0,
    }))
    .sort((a, b) => b.bookings - a.bookings);
}

// ── 6. Deal Velocity ─────────────────────────────────────────────────

export interface AgentVelocity {
  agentName: string;
  avgCycleTime: number;
  dealCount: number;
}

export interface DestinationVelocity {
  destination: string;
  avgCycleTime: number;
  dealCount: number;
}

export interface VelocityData {
  overallAvgCycleTime: number;
  totalDeals: number;
  byAgent: AgentVelocity[];
  byDestination: DestinationVelocity[];
}

export function computeVelocityData(
  data: CrmParsedData,
  tams: string[],
  agentFilter: 'tams' | 'all' = 'tams',
): VelocityData {
  // Use bookings for deal velocity (completed deals with timeTaken)
  const rows = filterRows(data.bookings, tams, agentFilter).filter(r => r.timeTaken > 0);

  const totalCycleTime = rows.reduce((sum, r) => sum + r.timeTaken, 0);
  const totalDeals = rows.length;
  const overallAvgCycleTime = totalDeals > 0 ? totalCycleTime / totalDeals : 0;

  // By agent
  const agentMap = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const entry = agentMap.get(r.agentName) || { total: 0, count: 0 };
    entry.total += r.timeTaken;
    entry.count++;
    agentMap.set(r.agentName, entry);
  }
  const byAgent: AgentVelocity[] = Array.from(agentMap.entries())
    .map(([agentName, { total, count }]) => ({
      agentName,
      avgCycleTime: total / count,
      dealCount: count,
    }))
    .sort((a, b) => a.avgCycleTime - b.avgCycleTime); // fastest first

  // By destination
  const destMap = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const dest = r.destination || 'Unknown';
    const entry = destMap.get(dest) || { total: 0, count: 0 };
    entry.total += r.timeTaken;
    entry.count++;
    destMap.set(dest, entry);
  }
  const byDestination: DestinationVelocity[] = Array.from(destMap.entries())
    .map(([destination, { total, count }]) => ({
      destination,
      avgCycleTime: total / count,
      dealCount: count,
    }))
    .sort((a, b) => a.avgCycleTime - b.avgCycleTime);

  return { overallAvgCycleTime, totalDeals, byAgent, byDestination };
}

// ── 7. Partner Intelligence ──────────────────────────────────────────

export interface PartnerStats {
  partnerName: string;
  assignedTam: string;
  enquiries: number;
  passthroughs: number;
  quotes: number;
  bookings: number;
  revenue: number;
  destinations: string[];
  funnelStatus: 'booked' | 'quoting' | 'progressing' | 'stalled';
}

export interface PartnerConcentration {
  tamName: string;
  partnerCount: number;
  totalEnquiries: number;
  totalBookings: number;
  totalRevenue: number;
}

export interface PartnerIntelligenceData {
  totalPartners: number;
  activePartners: number;
  stalledPartners: number;
  bookedPartners: number;
  partners: PartnerStats[];
  concentration: PartnerConcentration[];
  stalledList: PartnerStats[];
}

export function computePartnerIntelligence(
  data: CrmParsedData,
  tams: string[],
  agentFilter: 'tams' | 'all' = 'tams',
): PartnerIntelligenceData {
  // Gather B2B rows with non-empty travelAgentName from each report
  const enqRows = filterRows(data.enquiries, tams, agentFilter).filter(r => r.travelAgentName.trim());
  const ptRows = filterRows(data.passthroughs, tams, agentFilter).filter(r => r.travelAgentName.trim());
  const qtRows = filterRows(data.quotes, tams, agentFilter).filter(r => r.travelAgentName.trim() && r.tripRef.trim());
  const bkRows = filterRows(data.bookings, tams, agentFilter).filter(r => r.travelAgentName.trim());

  // Group by partner name (case-insensitive)
  const partnerMap = new Map<string, {
    displayName: string;
    agentCounts: Map<string, number>;
    enquiries: number;
    passthroughs: number;
    quotes: number;
    bookings: number;
    revenue: number;
    destinations: Set<string>;
  }>();

  const ensure = (name: string) => {
    const key = name.toLowerCase();
    if (!partnerMap.has(key)) {
      partnerMap.set(key, {
        displayName: name,
        agentCounts: new Map(),
        enquiries: 0,
        passthroughs: 0,
        quotes: 0,
        bookings: 0,
        revenue: 0,
        destinations: new Set(),
      });
    }
    return partnerMap.get(key)!;
  };

  const trackAgent = (entry: ReturnType<typeof ensure>, agentName: string) => {
    entry.agentCounts.set(agentName, (entry.agentCounts.get(agentName) || 0) + 1);
  };

  const trackDest = (entry: ReturnType<typeof ensure>, dest: string) => {
    if (dest) entry.destinations.add(dest);
  };

  for (const r of enqRows) {
    const entry = ensure(r.travelAgentName);
    entry.enquiries++;
    trackAgent(entry, r.agentName);
    trackDest(entry, r.destination);
  }
  for (const r of ptRows) {
    const entry = ensure(r.travelAgentName);
    entry.passthroughs++;
    trackAgent(entry, r.agentName);
    trackDest(entry, r.destination);
  }
  for (const r of qtRows) {
    const entry = ensure(r.travelAgentName);
    entry.quotes++;
    trackAgent(entry, r.agentName);
    trackDest(entry, r.destination);
  }
  for (const r of bkRows) {
    const entry = ensure(r.travelAgentName);
    entry.bookings++;
    entry.revenue += r.totalAmountBCY;
    trackAgent(entry, r.agentName);
    trackDest(entry, r.destination);
  }

  // Build PartnerStats
  const partners: PartnerStats[] = Array.from(partnerMap.values()).map(p => {
    // Assigned TAM = most frequent agentName
    let assignedTam = '';
    let maxCount = 0;
    for (const [agent, count] of p.agentCounts) {
      if (count > maxCount) {
        maxCount = count;
        assignedTam = agent;
      }
    }

    const funnelStatus: PartnerStats['funnelStatus'] =
      p.bookings > 0 ? 'booked' :
      p.quotes > 0 ? 'quoting' :
      p.passthroughs > 0 ? 'progressing' :
      'stalled';

    return {
      partnerName: p.displayName,
      assignedTam,
      enquiries: p.enquiries,
      passthroughs: p.passthroughs,
      quotes: p.quotes,
      bookings: p.bookings,
      revenue: p.revenue,
      destinations: Array.from(p.destinations).slice(0, 3),
      funnelStatus,
    };
  }).sort((a, b) => b.enquiries - a.enquiries);

  const stalledList = partners.filter(p => p.funnelStatus === 'stalled');

  // TAM portfolio concentration
  const tamMap = new Map<string, {
    partnerNames: Set<string>;
    totalEnquiries: number;
    totalBookings: number;
    totalRevenue: number;
  }>();

  for (const p of partners) {
    if (!p.assignedTam) continue;
    if (!tamMap.has(p.assignedTam)) {
      tamMap.set(p.assignedTam, { partnerNames: new Set(), totalEnquiries: 0, totalBookings: 0, totalRevenue: 0 });
    }
    const t = tamMap.get(p.assignedTam)!;
    t.partnerNames.add(p.partnerName);
    t.totalEnquiries += p.enquiries;
    t.totalBookings += p.bookings;
    t.totalRevenue += p.revenue;
  }

  const concentration: PartnerConcentration[] = Array.from(tamMap.entries())
    .map(([tamName, t]) => ({
      tamName,
      partnerCount: t.partnerNames.size,
      totalEnquiries: t.totalEnquiries,
      totalBookings: t.totalBookings,
      totalRevenue: t.totalRevenue,
    }))
    .sort((a, b) => b.totalEnquiries - a.totalEnquiries);

  return {
    totalPartners: partners.length,
    activePartners: partners.filter(p => p.passthroughs > 0).length,
    stalledPartners: stalledList.length,
    bookedPartners: partners.filter(p => p.bookings > 0).length,
    partners,
    concentration,
    stalledList,
  };
}
