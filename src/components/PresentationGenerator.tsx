import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Metrics, Team } from '../types';
import { generatePresentation, getDefaultConfig, THEME_INFO, type PresentationConfig, type ThemeStyle, type TopDestination, type AgentTopDestination } from '../utils/presentationGenerator';
import { WebPresentationViewer } from './webPresentation';
import {
  THEME_OPTIONS,
  ANIMATION_OPTIONS,
  LAYOUT_OPTIONS,
  type WebThemeStyle,
  type AnimationStyle,
  type LayoutStyle,
  type WebPresentationStyle,
} from './webPresentation/webPresentationConfig';
import type { RawParsedData } from '../utils/indexedDB';
import { findColumn } from '../utils/columnDetection';
import { findAgentColumn, findDateColumn } from '../utils/metricsCalculator';
import { formatDateString } from '../utils/dateParser';
import type { AllRecords, VolumeMetric, RateMetric, TimePeriod, RecordEntry } from '../utils/recordsTracker';
import { formatMetricName, formatPeriodName, formatRecordValue, formatDateRange } from '../utils/recordsTracker';

type PresentationMode = 'pptx' | 'web';

// Interface for destination stats with T>P rate
export interface DestinationStats {
  destinations: TopDestination[];
  totalTrips: number;
  totalPassthroughs: number;
  tpRate: number;
}

// Interface for recent achievements to show on Top Performers slide
export interface RecentAchievement {
  agentName: string;
  metric: VolumeMetric | RateMetric;
  period: TimePeriod;
  value: number;
  dateRange: string;
  formattedMetric: string;
  formattedPeriod: string;
  formattedValue: string;
}

const CASCADES_STORAGE_KEY = 'gtt_kpi_cascades';

// Extract recent record achievements for team members (performance period ended within last 7 days)
const extractRecentAchievements = (
  records: AllRecords | null | undefined,
  teamMembers: string[],
  daysBack: number = 7
): RecentAchievement[] => {
  if (!records?.agents) return [];

  const achievements: RecentAchievement[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Normalize team member names for comparison
  const teamMembersLower = new Set(teamMembers.map(m => m.toLowerCase()));

  const volumeMetrics: VolumeMetric[] = ['trips', 'quotes', 'passthroughs'];
  const rateMetrics: RateMetric[] = ['tq', 'tp', 'pq'];
  const volumePeriods: TimePeriod[] = ['day', 'week', 'month', 'quarter'];
  const ratePeriods: TimePeriod[] = ['month', 'quarter'];

  // Helper to parse YYYY-MM-DD date string
  const parseDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  for (const [agentName, agentRecords] of Object.entries(records.agents)) {
    // Check if agent is on the team
    if (!teamMembersLower.has(agentName.toLowerCase())) continue;

    // Check volume records
    for (const metric of volumeMetrics) {
      const metricRecords = agentRecords[metric] as Record<TimePeriod, RecordEntry | null>;
      for (const period of volumePeriods) {
        const record = metricRecords[period];
        if (record?.periodEnd) {
          // Use periodEnd to determine if the record is recent (when the performance actually happened)
          const periodEndDate = parseDate(record.periodEnd);
          if (periodEndDate >= cutoffDate && periodEndDate <= today) {
            achievements.push({
              agentName,
              metric,
              period,
              value: record.value,
              dateRange: formatDateRange(record.periodStart, record.periodEnd),
              formattedMetric: formatMetricName(metric),
              formattedPeriod: formatPeriodName(period),
              formattedValue: formatRecordValue(metric, record.value),
            });
          }
        }
      }
    }

    // Check rate records
    for (const metric of rateMetrics) {
      const metricRecords = agentRecords[metric] as Record<TimePeriod, RecordEntry | null>;
      for (const period of ratePeriods) {
        const record = metricRecords[period];
        if (record?.periodEnd) {
          // Use periodEnd to determine if the record is recent
          const periodEndDate = parseDate(record.periodEnd);
          if (periodEndDate >= cutoffDate && periodEndDate <= today) {
            achievements.push({
              agentName,
              metric,
              period,
              value: record.value,
              dateRange: formatDateRange(record.periodStart, record.periodEnd),
              formattedMetric: formatMetricName(metric),
              formattedPeriod: formatPeriodName(period),
              formattedValue: formatRecordValue(metric, record.value),
            });
          }
        }
      }
    }
  }

  // Sort by most recent first, then by value descending
  return achievements.sort((a, b) => {
    // Prefer more significant periods (quarter > month > week > day)
    const periodOrder = { quarter: 4, month: 3, week: 2, day: 1 };
    const periodDiff = periodOrder[b.period] - periodOrder[a.period];
    if (periodDiff !== 0) return periodDiff;
    return b.value - a.value;
  });
};

// Helper to convert date string to integer for comparison (YYYYMMDD format)
const dateToInt = (dateStr: string): number => {
  return parseInt(dateStr.replace(/-/g, ''), 10);
};

// Extract top destinations from passthroughs data, filtered by team members and date range
const extractTopDestinations = (
  rawData: RawParsedData | null,
  teamMembers: string[],
  startDate: string,
  endDate: string,
  limit: number = 5
): TopDestination[] => {
  if (!rawData?.passthroughs || rawData.passthroughs.length === 0) {
    return [];
  }

  const destCol = findColumn(rawData.passthroughs[0], ['destination', 'region', 'country', 'original interest']);
  const agentCol = findAgentColumn(rawData.passthroughs[0]);
  const dateCol = findDateColumn(rawData.passthroughs[0], ['passthrough to sales date', 'passthrough date', 'created date']);

  if (!destCol) {
    return [];
  }

  // Normalize team member names for comparison
  const teamMembersLower = new Set(teamMembers.map(m => m.trim().toLowerCase()));

  // Convert filter dates to integers for comparison
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  // Count destinations (filtered by team and date)
  const destCounts: Record<string, number> = {};
  for (const row of rawData.passthroughs) {
    // If we have an agent column, filter by team members
    if (agentCol) {
      const agent = (row[agentCol] || '').trim().toLowerCase();
      if (!teamMembersLower.has(agent)) {
        continue; // Skip if not on the team
      }
    }

    // Apply date filter if active
    if (hasDateFilter && dateCol) {
      const dateStr = formatDateString(row[dateCol]);
      if (!dateStr) continue; // Skip rows without valid date

      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
    }

    const dest = (row[destCol] || '').trim();
    if (dest) {
      destCounts[dest] = (destCounts[dest] || 0) + 1;
    }
  }

  // Sort and return top N
  return Object.entries(destCounts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// Extract top hot pass destinations from hot pass data, filtered by team members and date range
const extractHotPassDestinations = (
  rawData: RawParsedData | null,
  teamMembers: string[],
  startDate: string,
  endDate: string,
  limit: number = 5
): TopDestination[] => {
  if (!rawData?.hotPass || rawData.hotPass.length === 0) {
    return [];
  }

  const destCol = findColumn(rawData.hotPass[0], ['destination', 'region', 'country', 'original interest']);
  const agentCol = findAgentColumn(rawData.hotPass[0]);
  const dateCol = findDateColumn(rawData.hotPass[0], ['hot pass date', 'passthrough to sales date', 'passthrough date', 'created date']);

  if (!destCol) {
    return [];
  }

  // Normalize team member names for comparison
  const teamMembersLower = new Set(teamMembers.map(m => m.trim().toLowerCase()));

  // Convert filter dates to integers for comparison
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  // Count destinations (filtered by team and date)
  const destCounts: Record<string, number> = {};
  for (const row of rawData.hotPass) {
    // If we have an agent column, filter by team members
    if (agentCol) {
      const agent = (row[agentCol] || '').trim().toLowerCase();
      if (!teamMembersLower.has(agent)) {
        continue; // Skip if not on the team
      }
    }

    // Apply date filter if active
    if (hasDateFilter && dateCol) {
      const dateStr = formatDateString(row[dateCol]);
      if (!dateStr) continue; // Skip rows without valid date

      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
    }

    const dest = (row[destCol] || '').trim();
    if (dest) {
      destCounts[dest] = (destCounts[dest] || 0) + 1;
    }
  }

  // Sort and return top N
  return Object.entries(destCounts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// Extract top repeat T>P destinations from trips data with stats
const extractRepeatDestinations = (
  rawData: RawParsedData | null,
  teamMembers: string[],
  startDate: string,
  endDate: string,
  limit: number = 5
): DestinationStats => {
  const emptyResult: DestinationStats = { destinations: [], totalTrips: 0, totalPassthroughs: 0, tpRate: 0 };

  if (!rawData?.trips || rawData.trips.length === 0) {
    return emptyResult;
  }

  const keys = Object.keys(rawData.trips[0]);
  const destCol = findColumn(rawData.trips[0], ['destination', 'region', 'country', 'original interest']);
  const agentCol = findAgentColumn(rawData.trips[0]);
  const dateCol = findDateColumn(rawData.trips[0], ['trip created date', 'created date', 'date']);

  // Find repeat and passthrough columns
  const repeatCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('repeat') || lower.includes('client type') || lower.includes('customer type');
  });
  const passthroughDateCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('passthrough to sales date') || lower.includes('passthrough date');
  });

  if (!destCol || !repeatCol) {
    return emptyResult;
  }

  // Normalize team member names for comparison
  const teamMembersLower = new Set(teamMembers.map(m => m.trim().toLowerCase()));

  // Convert filter dates to integers for comparison
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  // Count destinations and track totals
  const destCounts: Record<string, number> = {};
  let totalTrips = 0;
  let totalPassthroughs = 0;

  for (const row of rawData.trips) {
    // Filter by team members
    if (agentCol) {
      const agent = (row[agentCol] || '').trim().toLowerCase();
      if (!teamMembersLower.has(agent)) {
        continue;
      }
    }

    // Check if repeat client
    const repeatValue = (row[repeatCol] || '').toString().toLowerCase().trim();
    const isRepeat = repeatValue === 'repeat' || repeatValue === 'returning' || repeatValue === 'existing';
    if (!isRepeat) continue;

    // Apply date filter if active
    if (hasDateFilter && dateCol) {
      const dateStr = formatDateString(row[dateCol]);
      if (!dateStr) continue;

      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
    }

    // Count this as a repeat trip
    totalTrips++;

    // Check if has passthrough
    const hasPassthrough = passthroughDateCol && row[passthroughDateCol] && row[passthroughDateCol].toString().trim() !== '';
    if (hasPassthrough) {
      totalPassthroughs++;
      const dest = (row[destCol] || '').trim();
      if (dest) {
        destCounts[dest] = (destCounts[dest] || 0) + 1;
      }
    }
  }

  const tpRate = totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0;

  const destinations = Object.entries(destCounts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { destinations, totalTrips, totalPassthroughs, tpRate };
};

// Extract top B2B T>P destinations from trips data with stats
const extractB2bDestinations = (
  rawData: RawParsedData | null,
  teamMembers: string[],
  startDate: string,
  endDate: string,
  limit: number = 5
): DestinationStats => {
  const emptyResult: DestinationStats = { destinations: [], totalTrips: 0, totalPassthroughs: 0, tpRate: 0 };

  if (!rawData?.trips || rawData.trips.length === 0) {
    return emptyResult;
  }

  const keys = Object.keys(rawData.trips[0]);
  const destCol = findColumn(rawData.trips[0], ['destination', 'region', 'country', 'original interest']);
  const agentCol = findAgentColumn(rawData.trips[0]);
  const dateCol = findDateColumn(rawData.trips[0], ['trip created date', 'created date', 'date']);

  // Find B2B and passthrough columns
  const b2bCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('b2b') || lower.includes('lead channel') || lower.includes('business type') || lower.includes('client category');
  });
  const passthroughDateCol = keys.find(k => {
    const lower = k.toLowerCase();
    return lower.includes('passthrough to sales date') || lower.includes('passthrough date');
  });

  if (!destCol || !b2bCol) {
    return emptyResult;
  }

  // Normalize team member names for comparison
  const teamMembersLower = new Set(teamMembers.map(m => m.trim().toLowerCase()));

  // Convert filter dates to integers for comparison
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  // Count destinations and track totals
  const destCounts: Record<string, number> = {};
  let totalTrips = 0;
  let totalPassthroughs = 0;

  for (const row of rawData.trips) {
    // Filter by team members
    if (agentCol) {
      const agent = (row[agentCol] || '').trim().toLowerCase();
      if (!teamMembersLower.has(agent)) {
        continue;
      }
    }

    // Check if B2B
    const b2bValue = (row[b2bCol] || '').toString().toLowerCase().trim();
    const isB2b = b2bValue === 'b2b' || b2bValue.includes('b2b') || b2bValue === 'business';
    if (!isB2b) continue;

    // Apply date filter if active
    if (hasDateFilter && dateCol) {
      const dateStr = formatDateString(row[dateCol]);
      if (!dateStr) continue;

      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
    }

    // Count this as a B2B trip
    totalTrips++;

    // Check if has passthrough
    const hasPassthrough = passthroughDateCol && row[passthroughDateCol] && row[passthroughDateCol].toString().trim() !== '';
    if (hasPassthrough) {
      totalPassthroughs++;
      const dest = (row[destCol] || '').trim();
      if (dest) {
        destCounts[dest] = (destCounts[dest] || 0) + 1;
      }
    }
  }

  const tpRate = totalTrips > 0 ? (totalPassthroughs / totalTrips) * 100 : 0;

  const destinations = Object.entries(destCounts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { destinations, totalTrips, totalPassthroughs, tpRate };
};

// Extract each team member's top destination, filtered by date range
const extractAgentTopDestinations = (
  rawData: RawParsedData | null,
  teamMembers: string[],
  startDate: string,
  endDate: string
): AgentTopDestination[] => {
  if (!rawData?.passthroughs || rawData.passthroughs.length === 0) {
    return [];
  }

  const destCol = findColumn(rawData.passthroughs[0], ['destination', 'region', 'country', 'original interest']);
  const agentCol = findAgentColumn(rawData.passthroughs[0]);
  const dateCol = findDateColumn(rawData.passthroughs[0], ['passthrough to sales date', 'passthrough date', 'created date']);

  if (!destCol || !agentCol) {
    return [];
  }

  // Normalize team member names for comparison
  const teamMembersLower = new Set(teamMembers.map(m => m.trim().toLowerCase()));

  // Convert filter dates to integers for comparison
  const startInt = startDate ? dateToInt(startDate) : null;
  const endInt = endDate ? dateToInt(endDate) : null;
  const hasDateFilter = startInt !== null || endInt !== null;

  // Count destinations per agent
  const agentDestCounts: Record<string, Record<string, number>> = {};
  for (const row of rawData.passthroughs) {
    const agent = (row[agentCol] || '').trim();
    const agentLower = agent.toLowerCase();

    if (!teamMembersLower.has(agentLower)) {
      continue; // Skip if not on the team
    }

    // Apply date filter if active
    if (hasDateFilter && dateCol) {
      const dateStr = formatDateString(row[dateCol]);
      if (!dateStr) continue; // Skip rows without valid date

      const rowInt = dateToInt(dateStr);
      if (startInt && rowInt < startInt) continue;
      if (endInt && rowInt > endInt) continue;
    }

    const dest = (row[destCol] || '').trim();
    if (dest) {
      if (!agentDestCounts[agent]) {
        agentDestCounts[agent] = {};
      }
      agentDestCounts[agent][dest] = (agentDestCounts[agent][dest] || 0) + 1;
    }
  }

  // For each agent, find their top destination
  const agentTopDests: AgentTopDestination[] = [];
  for (const [agentName, destCounts] of Object.entries(agentDestCounts)) {
    const entries = Object.entries(destCounts);
    if (entries.length === 0) continue;

    const [topDest, topCount] = entries.sort((a, b) => b[1] - a[1])[0];
    agentTopDests.push({
      agentName,
      destination: topDest,
      count: topCount,
    });
  }

  // Sort by total count descending
  return agentTopDests.sort((a, b) => b.count - a.count);
};

// Interface for destination with T>P stats
export interface ForecastDestination {
  destination: string;
  historicalCount: number;  // Passthroughs from previous year
  teamTrips: number;        // Team's trips to this destination (last 90 days)
  teamPassthroughs: number; // Team's passthroughs to this destination (last 90 days)
  teamTpRate: number;       // Team's T>P rate for this destination
}

// Interface for forecast destinations data
export interface ForecastDestinations {
  destinations: ForecastDestination[];
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  teamPeriodLabel: string;  // Label for team's 90-day period
}

// Extract top destinations for forecasting - looks at the previous year's same 60-day period
// DEPARTMENT-WIDE for historical data, then adds team's T>P for last 90 days
const extractForecastDestinations = (
  rawData: RawParsedData | null,
  meetingDate: Date,
  teamMembers: string[],
  limit: number = 5
): ForecastDestinations | null => {
  if (!rawData?.passthroughs || rawData.passthroughs.length === 0) {
    return null;
  }

  const destCol = findColumn(rawData.passthroughs[0], ['destination', 'region', 'country', 'original interest']);
  const dateCol = findDateColumn(rawData.passthroughs[0], ['passthrough to sales date', 'passthrough date', 'created date']);

  if (!destCol || !dateCol) {
    return null;
  }

  // Format dates helper
  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate date range: day after meeting date to 60 days after, but one year earlier
  // Example: meeting date Jan 26, 2026 → Jan 27, 2025 to Mar 27, 2025
  const historicalStart = new Date(meetingDate);
  historicalStart.setFullYear(historicalStart.getFullYear() - 1);
  historicalStart.setDate(historicalStart.getDate() + 1); // Day after meeting date

  const historicalEnd = new Date(historicalStart);
  historicalEnd.setDate(historicalEnd.getDate() + 59); // 60 days total (including start)

  const historicalStartStr = formatDate(historicalStart);
  const historicalEndStr = formatDate(historicalEnd);
  const historicalStartInt = dateToInt(historicalStartStr);
  const historicalEndInt = dateToInt(historicalEndStr);

  // Calculate team's 90-day period (ending on meeting date)
  const teamEnd = new Date(meetingDate);
  const teamStart = new Date(meetingDate);
  teamStart.setDate(teamStart.getDate() - 89); // 90 days including end date

  const teamStartStr = formatDate(teamStart);
  const teamEndStr = formatDate(teamEnd);
  const teamStartInt = dateToInt(teamStartStr);
  const teamEndInt = dateToInt(teamEndStr);

  // Normalize team member names for comparison
  const teamMembersLower = new Set(teamMembers.map(m => m.trim().toLowerCase()));

  // Count destinations (department-wide, historical period)
  const destCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const row of rawData.passthroughs) {
    const dateStr = formatDateString(row[dateCol]);
    if (!dateStr) continue;

    const rowInt = dateToInt(dateStr);
    if (rowInt < historicalStartInt || rowInt > historicalEndInt) continue;

    const dest = (row[destCol] || '').trim();
    if (dest) {
      destCounts[dest] = (destCounts[dest] || 0) + 1;
      totalRecords++;
    }
  }

  // If no historical records found, return null
  if (totalRecords === 0) {
    return null;
  }

  // Get top destinations from historical data
  const topDestinations = Object.entries(destCounts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  // Now calculate team's T>P for each of these destinations (last 90 days)
  // We need to look at trips data for trips and check passthrough date for conversions

  const teamTripsByDest: Record<string, number> = {};
  const teamPassthroughsByDest: Record<string, number> = {};

  // Get destination names we care about
  const targetDestinations = new Set(topDestinations.map(d => d.destination.toLowerCase()));

  // Process trips data for team's T>P by destination
  if (rawData.trips && rawData.trips.length > 0) {
    const tripsDestCol = findColumn(rawData.trips[0], ['destination', 'region', 'country', 'original interest']);
    const tripsAgentCol = findAgentColumn(rawData.trips[0]);
    const tripsDateCol = findDateColumn(rawData.trips[0], ['trip created date', 'created date', 'date']);
    const keys = Object.keys(rawData.trips[0]);
    const passthroughDateCol = keys.find(k => {
      const lower = k.toLowerCase();
      return lower.includes('passthrough to sales date') || lower.includes('passthrough date');
    });

    if (tripsDestCol && tripsAgentCol && tripsDateCol) {
      for (const row of rawData.trips) {
        // Filter by team members
        const agent = (row[tripsAgentCol] || '').trim().toLowerCase();
        if (!teamMembersLower.has(agent)) continue;

        // Filter by date (last 90 days)
        const dateStr = formatDateString(row[tripsDateCol]);
        if (!dateStr) continue;
        const rowInt = dateToInt(dateStr);
        if (rowInt < teamStartInt || rowInt > teamEndInt) continue;

        // Get destination
        const dest = (row[tripsDestCol] || '').trim();
        const destLower = dest.toLowerCase();
        if (!dest || !targetDestinations.has(destLower)) continue;

        // Count this trip
        teamTripsByDest[dest] = (teamTripsByDest[dest] || 0) + 1;

        // Check if has passthrough
        const hasPassthrough = passthroughDateCol && row[passthroughDateCol] && row[passthroughDateCol].toString().trim() !== '';
        if (hasPassthrough) {
          teamPassthroughsByDest[dest] = (teamPassthroughsByDest[dest] || 0) + 1;
        }
      }
    }
  }

  // Build final destinations array with T>P stats
  const destinations: ForecastDestination[] = topDestinations.map(d => {
    // Find matching team stats (case-insensitive)
    let teamTrips = 0;
    let teamPassthroughs = 0;

    for (const [dest, trips] of Object.entries(teamTripsByDest)) {
      if (dest.toLowerCase() === d.destination.toLowerCase()) {
        teamTrips = trips;
        break;
      }
    }
    for (const [dest, pts] of Object.entries(teamPassthroughsByDest)) {
      if (dest.toLowerCase() === d.destination.toLowerCase()) {
        teamPassthroughs = pts;
        break;
      }
    }

    return {
      destination: d.destination,
      historicalCount: d.count,
      teamTrips,
      teamPassthroughs,
      teamTpRate: teamTrips > 0 ? (teamPassthroughs / teamTrips) * 100 : 0,
    };
  });

  // Format period labels for display
  const formatDisplayDate = (d: Date): string => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return {
    destinations,
    periodStart: historicalStartStr,
    periodEnd: historicalEndStr,
    periodLabel: `${formatDisplayDate(historicalStart)} - ${formatDisplayDate(historicalEnd)}`,
    teamPeriodLabel: `${formatDisplayDate(teamStart)} - ${formatDisplayDate(teamEnd)}`,
  };
};

interface PresentationGeneratorProps {
  metrics: Metrics[];
  seniors: string[];
  teams: Team[];
  rawData?: RawParsedData | null;
  records?: AllRecords | null;
  startDate?: string;
  endDate?: string;
}

export const PresentationGenerator: React.FC<PresentationGeneratorProps> = ({
  metrics,
  seniors,
  teams,
  rawData,
  records,
  startDate = '',
  endDate = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [presentationMode, setPresentationMode] = useState<PresentationMode>('pptx');
  const [showWebPresentation, setShowWebPresentation] = useState(false);
  const [webStyle, setWebStyle] = useState<WebPresentationStyle>({
    theme: 'dark-modern',
    animation: 'slide',
    layout: 'default',
  });
  const [config, setConfig] = useState<PresentationConfig>(() => {
    const defaultConfig = getDefaultConfig();
    // Default to first team or "My Team" if it exists
    const myTeam = teams.find(t => t.name.toLowerCase() === 'my team');
    const defaultTeam = myTeam || teams[0];
    // Load cascades from localStorage
    let savedCascades: string[] = [];
    try {
      const stored = localStorage.getItem(CASCADES_STORAGE_KEY);
      if (stored) {
        savedCascades = JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    return {
      ...defaultConfig,
      selectedTeamId: defaultTeam?.id || null,
      cascades: savedCascades,
    };
  });
  const [newCascade, setNewCascade] = useState('');

  // Find selected team to show preview
  const selectedTeam = config.selectedTeamId
    ? teams.find(t => t.id === config.selectedTeamId)
    : teams.find(t => t.name.toLowerCase() === 'my team') || teams[0];
  const selectedTeamMembers = selectedTeam?.agentNames || [];

  // Extract top destinations from raw data, filtered by team and date range
  const topDestinations = useMemo(
    () => extractTopDestinations(rawData || null, selectedTeamMembers, startDate, endDate, 5),
    [rawData, selectedTeamMembers, startDate, endDate]
  );

  // Extract each agent's top destination, filtered by date range
  const agentTopDestinations = useMemo(
    () => extractAgentTopDestinations(rawData || null, selectedTeamMembers, startDate, endDate),
    [rawData, selectedTeamMembers, startDate, endDate]
  );

  // Extract hot pass destinations, filtered by date range
  const hotPassDestinations = useMemo(
    () => extractHotPassDestinations(rawData || null, selectedTeamMembers, startDate, endDate, 5),
    [rawData, selectedTeamMembers, startDate, endDate]
  );

  // Extract repeat T>P destinations, filtered by date range
  const repeatDestinations = useMemo(
    () => extractRepeatDestinations(rawData || null, selectedTeamMembers, startDate, endDate, 5),
    [rawData, selectedTeamMembers, startDate, endDate]
  );

  // Extract B2B T>P destinations, filtered by date range
  const b2bDestinations = useMemo(
    () => extractB2bDestinations(rawData || null, selectedTeamMembers, startDate, endDate, 5),
    [rawData, selectedTeamMembers, startDate, endDate]
  );

  // Extract recent achievements (records set in last 7 days) for team members
  const recentAchievements = useMemo(
    () => extractRecentAchievements(records, selectedTeamMembers, 7),
    [records, selectedTeamMembers]
  );

  // Extract forecast destinations from previous year's same 60-day period (department-wide)
  // Also calculates team's T>P for each destination over last 90 days
  const forecastDestinations = useMemo(
    () => extractForecastDestinations(rawData || null, config.meetingDate, selectedTeamMembers, 5),
    [rawData, config.meetingDate, selectedTeamMembers]
  );

  // Persist cascades to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(CASCADES_STORAGE_KEY, JSON.stringify(config.cascades));
    } catch {
      // Ignore storage errors
    }
  }, [config.cascades]);

  const selectedTeamCount = selectedTeamMembers.length;
  const selectedTeamMetrics = metrics.filter(m =>
    selectedTeamMembers.some(name => name.toLowerCase() === m.agentName.toLowerCase())
  );

  const handleGenerate = useCallback(async () => {
    if (presentationMode === 'web') {
      setShowWebPresentation(true);
      setIsOpen(false);
      return;
    }

    setIsGenerating(true);
    try {
      const configWithDestinations = {
        ...config,
        topDestinations,
        agentTopDestinations,
      };
      await generatePresentation(metrics, seniors, teams, configWithDestinations);
    } catch (error) {
      console.error('Failed to generate presentation:', error);
      alert('Failed to generate presentation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [metrics, seniors, teams, config, presentationMode, topDestinations, agentTopDestinations]);

  const addCascade = useCallback(() => {
    if (newCascade.trim()) {
      setConfig(prev => ({
        ...prev,
        cascades: [...prev.cascades, newCascade.trim()],
      }));
      setNewCascade('');
    }
  }, [newCascade]);

  const removeCascade = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      cascades: prev.cascades.filter((_, i) => i !== index),
    }));
  }, []);

  const clearAllCascades = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      cascades: [],
    }));
  }, []);

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const buttonElement = (
    <button
      onClick={() => setIsOpen(true)}
      disabled={metrics.length === 0}
      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl shadow-lg hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13l-3 3m0 0l-3-3m3 3V8" />
      </svg>
      Generate Slides
    </button>
  );

  const modalElement = isOpen ? (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Generate Team Huddle</h2>
            <p className="text-slate-400 text-sm mt-1">Customize your presentation settings</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Select Team for Slides</label>
            {teams.length > 0 ? (
              <select
                value={config.selectedTeamId || ''}
                onChange={(e) => {
                  const teamId = e.target.value || null;
                  const team = teams.find(t => t.id === teamId);
                  setConfig(prev => ({
                    ...prev,
                    selectedTeamId: teamId,
                    teamName: team?.name || prev.teamName,
                  }));
                }}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.agentNames.length} members)
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-amber-400 text-sm">No teams created yet. Create a team in the Config panel to generate team-specific slides.</p>
            )}
          </div>

          {/* Team Name & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Presentation Title</label>
              <input
                type="text"
                value={config.teamName}
                onChange={(e) => setConfig(prev => ({ ...prev, teamName: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="Team GTT"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Meeting Date</label>
              <input
                type="date"
                value={formatDateForInput(config.meetingDate)}
                onChange={(e) => setConfig(prev => ({ ...prev, meetingDate: new Date(e.target.value) }))}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Presentation Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Output Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPresentationMode('pptx')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  presentationMode === 'pptx'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className={presentationMode === 'pptx' ? 'text-white' : 'text-slate-300'}>
                  PowerPoint (.pptx)
                </span>
              </button>
              <button
                onClick={() => setPresentationMode('web')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  presentationMode === 'web'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className={presentationMode === 'web' ? 'text-white' : 'text-slate-300'}>
                  Web Presentation
                </span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {presentationMode === 'pptx'
                ? 'Download a PowerPoint file to present offline'
                : 'Present directly in browser with animated transitions'}
            </p>
          </div>

          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Color Theme {presentationMode === 'web' && <span className="text-indigo-400">(11 options)</span>}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {(presentationMode === 'web'
                ? (Object.keys(THEME_OPTIONS) as WebThemeStyle[])
                : (Object.keys(THEME_INFO) as ThemeStyle[])
              ).map((themeKey) => {
                const theme = presentationMode === 'web' ? THEME_OPTIONS[themeKey as WebThemeStyle] : THEME_INFO[themeKey as ThemeStyle];
                const currentTheme = presentationMode === 'web' ? webStyle.theme : config.theme;
                const isSelected = currentTheme === themeKey;
                return (
                  <button
                    key={themeKey}
                    onClick={() => {
                      if (presentationMode === 'web') {
                        setWebStyle(prev => ({ ...prev, theme: themeKey as WebThemeStyle }));
                      } else {
                        setConfig(prev => ({ ...prev, theme: themeKey as ThemeStyle }));
                      }
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
                    }`}
                  >
                    <div className="flex gap-1">
                      {theme.preview.map((color, i) => (
                        <div
                          key={i}
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: `#${color}` }}
                        />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {theme.name}
                      </div>
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Web-only: Animation & Layout Options */}
          {presentationMode === 'web' && (
            <>
              {/* Animation Style */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Transition Animation
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.keys(ANIMATION_OPTIONS) as AnimationStyle[]).map((animKey) => {
                    const anim = ANIMATION_OPTIONS[animKey];
                    const isSelected = webStyle.animation === animKey;
                    return (
                      <button
                        key={animKey}
                        onClick={() => setWebStyle(prev => ({ ...prev, animation: animKey }))}
                        className={`p-2.5 rounded-lg border-2 transition-all text-center ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
                        }`}
                        title={anim.description}
                      >
                        <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {anim.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Layout Style */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Layout Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(LAYOUT_OPTIONS) as LayoutStyle[]).map((layoutKey) => {
                    const layout = LAYOUT_OPTIONS[layoutKey];
                    const isSelected = webStyle.layout === layoutKey;
                    return (
                      <button
                        key={layoutKey}
                        onClick={() => setWebStyle(prev => ({ ...prev, layout: layoutKey }))}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
                        }`}
                      >
                        <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {layout.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {layout.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Monthly Goals - Team Total */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Monthly Team Goals
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.monthlyGoalPassthroughs}
                    onChange={(e) => setConfig(prev => ({ ...prev, monthlyGoalPassthroughs: parseInt(e.target.value) || 0 }))}
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <span className="text-slate-400 text-sm">Passthroughs</span>
                </div>
                {selectedTeamCount > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    ~{Math.round(config.monthlyGoalPassthroughs / selectedTeamCount)} per person
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.monthlyGoalQuotes}
                    onChange={(e) => setConfig(prev => ({ ...prev, monthlyGoalQuotes: parseInt(e.target.value) || 0 }))}
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <span className="text-slate-400 text-sm">Quotes</span>
                </div>
                {selectedTeamCount > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    ~{Math.round(config.monthlyGoalQuotes / selectedTeamCount)} per person
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Cascades */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                Cascades & Announcements
              </label>
              {config.cascades.length > 0 && (
                <button
                  onClick={clearAllCascades}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Cascades are saved automatically and persist between sessions.
            </p>
            <div className="space-y-2">
              {config.cascades.map((cascade, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-900 rounded-lg p-3">
                  <span className="flex-1 text-white text-sm">{cascade}</span>
                  <button
                    onClick={() => removeCascade(index)}
                    className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                    title="Remove this cascade"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCascade}
                  onChange={(e) => setNewCascade(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCascade()}
                  className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Add a cascade or announcement..."
                />
                <button
                  onClick={addCascade}
                  disabled={!newCascade.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Data Summary - Selected Team */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              {selectedTeam?.name || 'Team'} Preview
              {!selectedTeam && (
                <span className="text-amber-400 ml-2 text-xs">(Select a team to see preview)</span>
              )}
            </h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{selectedTeamCount}</div>
                <div className="text-xs text-slate-400">Members</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-400">
                  {selectedTeamMetrics.reduce((sum, m) => sum + m.passthroughs, 0)}
                </div>
                <div className="text-xs text-slate-400">Passthroughs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">
                  {selectedTeamMetrics.reduce((sum, m) => sum + m.quotes, 0)}
                </div>
                <div className="text-xs text-slate-400">Quotes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-400">
                  {selectedTeamMetrics.reduce((sum, m) => sum + m.bookings, 0)}
                </div>
                <div className="text-xs text-slate-400">Bookings</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={() => setIsOpen(false)}
            className="px-6 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || metrics.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : presentationMode === 'web' ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Presentation
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Presentation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {buttonElement}
      {modalElement}
      {showWebPresentation && (
        <WebPresentationViewer
          metrics={metrics}
          seniors={seniors}
          teams={teams}
          config={{ ...config, topDestinations, agentTopDestinations }}
          webStyle={webStyle}
          recentAchievements={recentAchievements}
          hotPassDestinations={hotPassDestinations}
          repeatStats={repeatDestinations}
          b2bStats={b2bDestinations}
          forecastDestinations={forecastDestinations}
          onClose={() => setShowWebPresentation(false)}
        />
      )}
    </>
  );
};
