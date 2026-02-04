import type { TimeSeriesData, DailyAgentMetrics } from '../types';

// ============ Types ============

export type VolumeMetric = 'trips' | 'quotes' | 'passthroughs';
export type RateMetric = 'tq' | 'tp' | 'pq';
export type TimePeriod = 'day' | 'week' | 'month' | 'quarter';

export interface RecordEntry {
  value: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  setAt: string;       // ISO timestamp when record was set
}

export interface AgentRecords {
  agentName: string;
  // Volume records (day, week, month, quarter)
  trips: {
    day: RecordEntry | null;
    week: RecordEntry | null;
    month: RecordEntry | null;
    quarter: RecordEntry | null;
  };
  quotes: {
    day: RecordEntry | null;
    week: RecordEntry | null;
    month: RecordEntry | null;
    quarter: RecordEntry | null;
  };
  passthroughs: {
    day: RecordEntry | null;
    week: RecordEntry | null;
    month: RecordEntry | null;
    quarter: RecordEntry | null;
  };
  // Rate records (month, quarter only)
  tq: {
    month: RecordEntry | null;
    quarter: RecordEntry | null;
  };
  tp: {
    month: RecordEntry | null;
    quarter: RecordEntry | null;
  };
  pq: {
    month: RecordEntry | null;
    quarter: RecordEntry | null;
  };
}

export interface RecordUpdate {
  agentName: string;
  metric: VolumeMetric | RateMetric;
  period: TimePeriod;
  previousValue: number | null;
  newValue: number;
  periodStart: string;
  periodEnd: string;
  timestamp: string;
}

export interface AllRecords {
  agents: Record<string, AgentRecords>;
  lastUpdated: string;
}

// ============ Storage ============

const STORAGE_KEY = 'gtt-agent-records';

// Migrate old records to include 'day' field for volume metrics
const migrateRecords = (records: AllRecords): AllRecords => {
  const volumeMetrics: VolumeMetric[] = ['trips', 'quotes', 'passthroughs'];

  for (const agentName of Object.keys(records.agents)) {
    const agent = records.agents[agentName];
    for (const metric of volumeMetrics) {
      // Add 'day' field if it doesn't exist
      if (agent[metric] && !('day' in agent[metric])) {
        (agent[metric] as { day: RecordEntry | null; week: RecordEntry | null; month: RecordEntry | null; quarter: RecordEntry | null }).day = null;
      }
    }
  }

  return records;
};

export const loadRecords = (): AllRecords => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migrateRecords(parsed);
    }
  } catch (e) {
    console.error('Failed to load records:', e);
  }
  return { agents: {}, lastUpdated: new Date().toISOString() };
};

export const saveRecords = (records: AllRecords): void => {
  try {
    records.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save records:', e);
  }
};

export const clearRecords = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

// ============ Date Utilities ============

const getDayStart = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getDayEnd = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
};

const getWeekEnd = (date: Date): Date => {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
};

const getMonthStart = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getMonthEnd = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const getQuarterStart = (date: Date): Date => {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
};

const getQuarterEnd = (date: Date): Date => {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), (quarter + 1) * 3, 0);
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// ============ Period Aggregation ============

interface PeriodData {
  periodStart: string;
  periodEnd: string;
  trips: number;
  quotes: number;
  passthroughs: number;
}

const aggregateByPeriod = (
  dailyMetrics: DailyAgentMetrics[],
  getPeriodStart: (date: Date) => Date,
  getPeriodEnd: (date: Date) => Date
): PeriodData[] => {
  const periods = new Map<string, PeriodData>();

  for (const day of dailyMetrics) {
    if (day.date === 'unknown') continue;

    const date = parseDate(day.date);
    const periodStart = formatDate(getPeriodStart(date));
    const periodEnd = formatDate(getPeriodEnd(date));
    const key = `${periodStart}_${periodEnd}`;

    if (!periods.has(key)) {
      periods.set(key, {
        periodStart,
        periodEnd,
        trips: 0,
        quotes: 0,
        passthroughs: 0,
      });
    }

    const period = periods.get(key)!;
    period.trips += day.trips;
    period.quotes += day.quotes;
    period.passthroughs += day.passthroughs;
  }

  return Array.from(periods.values());
};

// Check if a period has completed (period end date is before today)
const isPeriodComplete = (periodEnd: string): boolean => {
  const periodEndDate = parseDate(periodEnd);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodEndDay = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), periodEndDate.getDate());

  // Period is complete if today is after the period end date
  return todayStart > periodEndDay;
};

// Calculate rate for a period (needs sufficient volume)
// Only returns rates for COMPLETED periods
const calculatePeriodRate = (
  dailyMetrics: DailyAgentMetrics[],
  getPeriodStart: (date: Date) => Date,
  getPeriodEnd: (date: Date) => Date,
  rateType: RateMetric
): { periodStart: string; periodEnd: string; rate: number }[] => {
  const periods = aggregateByPeriod(dailyMetrics, getPeriodStart, getPeriodEnd);

  return periods
    .map(p => {
      let rate = 0;
      if (rateType === 'tq' && p.trips > 0) {
        rate = (p.quotes / p.trips) * 100;
      } else if (rateType === 'tp' && p.trips > 0) {
        rate = (p.passthroughs / p.trips) * 100;
      } else if (rateType === 'pq' && p.passthroughs > 0) {
        rate = (p.quotes / p.passthroughs) * 100;
      }
      return { periodStart: p.periodStart, periodEnd: p.periodEnd, rate };
    })
    .filter(p => p.rate > 0 && isPeriodComplete(p.periodEnd)); // Only include completed periods with actual data
};

// ============ Record Checking ============

const createEmptyAgentRecords = (agentName: string): AgentRecords => ({
  agentName,
  trips: { day: null, week: null, month: null, quarter: null },
  quotes: { day: null, week: null, month: null, quarter: null },
  passthroughs: { day: null, week: null, month: null, quarter: null },
  tq: { month: null, quarter: null },
  tp: { month: null, quarter: null },
  pq: { month: null, quarter: null },
});

const checkAndUpdateVolumeRecord = (
  currentRecord: RecordEntry | null,
  value: number,
  periodStart: string,
  periodEnd: string
): { updated: boolean; previousValue: number | null; newRecord: RecordEntry | null } => {
  if (value <= 0) {
    return { updated: false, previousValue: null, newRecord: currentRecord };
  }

  // If this is the same period as the existing record, always update with the new value
  // (newer data is more complete/accurate than older partial data)
  const isSamePeriod = currentRecord &&
    currentRecord.periodStart === periodStart &&
    currentRecord.periodEnd === periodEnd;

  if (!currentRecord || isSamePeriod || value > currentRecord.value) {
    const isActualUpdate = !currentRecord || value !== currentRecord.value;
    return {
      updated: isActualUpdate,
      previousValue: currentRecord?.value || null,
      newRecord: {
        value,
        periodStart,
        periodEnd,
        setAt: new Date().toISOString(),
      },
    };
  }

  return { updated: false, previousValue: null, newRecord: currentRecord };
};

const checkAndUpdateRateRecord = (
  currentRecord: RecordEntry | null,
  rate: number,
  periodStart: string,
  periodEnd: string
): { updated: boolean; previousValue: number | null; newRecord: RecordEntry | null } => {
  // Rate must be > 0 and reasonable (< 200% as sanity check)
  if (rate <= 0 || rate > 200) {
    return { updated: false, previousValue: null, newRecord: currentRecord };
  }

  // If this is the same period as the existing record, always update with the new value
  // (newer data is more complete/accurate than older partial data)
  const isSamePeriod = currentRecord &&
    currentRecord.periodStart === periodStart &&
    currentRecord.periodEnd === periodEnd;

  if (!currentRecord || isSamePeriod || rate > currentRecord.value) {
    const isActualUpdate = !currentRecord || rate !== currentRecord.value;
    return {
      updated: isActualUpdate,
      previousValue: currentRecord?.value || null,
      newRecord: {
        value: rate,
        periodStart,
        periodEnd,
        setAt: new Date().toISOString(),
      },
    };
  }

  return { updated: false, previousValue: null, newRecord: currentRecord };
};

// ============ Main Analysis Function ============

export const analyzeAndUpdateRecords = (
  timeSeriesData: TimeSeriesData,
  existingRecords: AllRecords
): { updatedRecords: AllRecords; updates: RecordUpdate[] } => {
  const updates: RecordUpdate[] = [];
  const newRecords: AllRecords = {
    agents: { ...existingRecords.agents },
    lastUpdated: new Date().toISOString(),
  };

  for (const agent of timeSeriesData.agents) {
    const { agentName, dailyMetrics } = agent;

    if (!newRecords.agents[agentName]) {
      newRecords.agents[agentName] = createEmptyAgentRecords(agentName);
    }

    // Ensure the agent record has all required fields (migration for 'day')
    const existingRecord = newRecords.agents[agentName];
    const agentRecords: AgentRecords = {
      agentName,
      trips: { day: existingRecord.trips?.day ?? null, week: existingRecord.trips?.week ?? null, month: existingRecord.trips?.month ?? null, quarter: existingRecord.trips?.quarter ?? null },
      quotes: { day: existingRecord.quotes?.day ?? null, week: existingRecord.quotes?.week ?? null, month: existingRecord.quotes?.month ?? null, quarter: existingRecord.quotes?.quarter ?? null },
      passthroughs: { day: existingRecord.passthroughs?.day ?? null, week: existingRecord.passthroughs?.week ?? null, month: existingRecord.passthroughs?.month ?? null, quarter: existingRecord.passthroughs?.quarter ?? null },
      tq: { month: existingRecord.tq?.month ?? null, quarter: existingRecord.tq?.quarter ?? null },
      tp: { month: existingRecord.tp?.month ?? null, quarter: existingRecord.tp?.quarter ?? null },
      pq: { month: existingRecord.pq?.month ?? null, quarter: existingRecord.pq?.quarter ?? null },
    };

    // Aggregate data by period
    const dailyData = aggregateByPeriod(dailyMetrics, getDayStart, getDayEnd);
    const weeklyData = aggregateByPeriod(dailyMetrics, getWeekStart, getWeekEnd);
    const monthlyData = aggregateByPeriod(dailyMetrics, getMonthStart, getMonthEnd);
    const quarterlyData = aggregateByPeriod(dailyMetrics, getQuarterStart, getQuarterEnd);

    // Check volume records
    const volumeMetrics: VolumeMetric[] = ['trips', 'quotes', 'passthroughs'];

    for (const metric of volumeMetrics) {
      // Daily
      for (const period of dailyData) {
        const result = checkAndUpdateVolumeRecord(
          agentRecords[metric].day,
          period[metric],
          period.periodStart,
          period.periodEnd
        );
        if (result.updated) {
          agentRecords[metric] = { ...agentRecords[metric], day: result.newRecord };
          updates.push({
            agentName,
            metric,
            period: 'day',
            previousValue: result.previousValue,
            newValue: period[metric],
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Weekly
      for (const period of weeklyData) {
        const result = checkAndUpdateVolumeRecord(
          agentRecords[metric].week,
          period[metric],
          period.periodStart,
          period.periodEnd
        );
        if (result.updated) {
          agentRecords[metric] = { ...agentRecords[metric], week: result.newRecord };
          updates.push({
            agentName,
            metric,
            period: 'week',
            previousValue: result.previousValue,
            newValue: period[metric],
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Monthly
      for (const period of monthlyData) {
        const result = checkAndUpdateVolumeRecord(
          agentRecords[metric].month,
          period[metric],
          period.periodStart,
          period.periodEnd
        );
        if (result.updated) {
          agentRecords[metric] = { ...agentRecords[metric], month: result.newRecord };
          updates.push({
            agentName,
            metric,
            period: 'month',
            previousValue: result.previousValue,
            newValue: period[metric],
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Quarterly
      for (const period of quarterlyData) {
        const result = checkAndUpdateVolumeRecord(
          agentRecords[metric].quarter,
          period[metric],
          period.periodStart,
          period.periodEnd
        );
        if (result.updated) {
          agentRecords[metric] = { ...agentRecords[metric], quarter: result.newRecord };
          updates.push({
            agentName,
            metric,
            period: 'quarter',
            previousValue: result.previousValue,
            newValue: period[metric],
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Check rate records (monthly and quarterly only)
    const rateMetrics: RateMetric[] = ['tq', 'tp', 'pq'];

    for (const metric of rateMetrics) {
      // Monthly rates
      const monthlyRates = calculatePeriodRate(dailyMetrics, getMonthStart, getMonthEnd, metric);
      for (const period of monthlyRates) {
        const result = checkAndUpdateRateRecord(
          agentRecords[metric].month,
          period.rate,
          period.periodStart,
          period.periodEnd
        );
        if (result.updated) {
          agentRecords[metric] = { ...agentRecords[metric], month: result.newRecord };
          updates.push({
            agentName,
            metric,
            period: 'month',
            previousValue: result.previousValue,
            newValue: period.rate,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Quarterly rates
      const quarterlyRates = calculatePeriodRate(dailyMetrics, getQuarterStart, getQuarterEnd, metric);
      for (const period of quarterlyRates) {
        const result = checkAndUpdateRateRecord(
          agentRecords[metric].quarter,
          period.rate,
          period.periodStart,
          period.periodEnd
        );
        if (result.updated) {
          agentRecords[metric] = { ...agentRecords[metric], quarter: result.newRecord };
          updates.push({
            agentName,
            metric,
            period: 'quarter',
            previousValue: result.previousValue,
            newValue: period.rate,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    newRecords.agents[agentName] = agentRecords;
  }

  return { updatedRecords: newRecords, updates };
};

// ============ Display Helpers ============

export const formatMetricName = (metric: VolumeMetric | RateMetric): string => {
  const names: Record<string, string> = {
    trips: 'Trips',
    quotes: 'Quotes',
    passthroughs: 'Passthroughs',
    tq: 'T>Q %',
    tp: 'T>P %',
    pq: 'P>Q %',
  };
  return names[metric] || metric;
};

export const formatPeriodName = (period: TimePeriod): string => {
  const names: Record<TimePeriod, string> = {
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
    quarter: 'Quarterly',
  };
  return names[period];
};

export const formatRecordValue = (metric: VolumeMetric | RateMetric, value: number): string => {
  if (['tq', 'tp', 'pq'].includes(metric)) {
    return `${value.toFixed(1)}%`;
  }
  return value.toLocaleString();
};

export const formatDateRange = (start: string, end: string): string => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  // Daily: same start and end
  if (start === end) {
    return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Check if it's a full month (1st to last day of same month)
  const isMonthStart = startDate.getDate() === 1;
  const isMonthEnd = endDate.getDate() === new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();

  if (isMonthStart && isMonthEnd && sameMonth) {
    return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // Check if it's a full quarter
  const quarterStartMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
  const quarterEndMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec
  const isQuarterStart = isMonthStart && quarterStartMonths.includes(startDate.getMonth());
  const isQuarterEnd = isMonthEnd && quarterEndMonths.includes(endDate.getMonth());
  const sameQuarter = Math.floor(startDate.getMonth() / 3) === Math.floor(endDate.getMonth() / 3) &&
                      startDate.getFullYear() === endDate.getFullYear();

  if (isQuarterStart && isQuarterEnd && sameQuarter) {
    const quarter = Math.floor(startDate.getMonth() / 3) + 1;
    return `Q${quarter} ${startDate.getFullYear()}`;
  }

  // Default: show full range (for weekly or other periods)
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = startDate.toLocaleDateString('en-US', options);
  const endStr = endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' });

  return `${startStr} - ${endStr}`;
};
