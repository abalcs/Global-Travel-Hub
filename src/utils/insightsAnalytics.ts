import type { CSVRow } from './csvParser';
import type { RawParsedData } from './indexedDB';
import Anthropic from '@anthropic-ai/sdk';

// ============ Date/Time Parsing ============

interface ParsedDateTime {
  date: Date;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  hour: number;
  timeSlot: string; // "Morning", "Afternoon", etc.
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
  { name: 'Early Morning (6-9am)', start: 6, end: 9 },
  { name: 'Morning (9am-12pm)', start: 9, end: 12 },
  { name: 'Afternoon (12-3pm)', start: 12, end: 15 },
  { name: 'Late Afternoon (3-6pm)', start: 15, end: 18 },
  { name: 'Evening (6-9pm)', start: 18, end: 21 },
  { name: 'Night (9pm-6am)', start: 21, end: 6 },
];

const getTimeSlot = (hour: number): string => {
  for (const slot of TIME_SLOTS) {
    if (slot.start < slot.end) {
      if (hour >= slot.start && hour < slot.end) return slot.name;
    } else {
      // Night wraps around
      if (hour >= slot.start || hour < slot.end) return slot.name;
    }
  }
  return 'Unknown';
};

const parseDateTime = (value: string): ParsedDateTime | null => {
  if (!value || value.trim() === '') return null;

  // Try Excel serial number with time (includes decimal for time)
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
    if (!isNaN(jsDate.getTime())) {
      return {
        date: jsDate,
        dayOfWeek: jsDate.getDay(),
        dayName: DAY_NAMES[jsDate.getDay()],
        hour: jsDate.getHours(),
        timeSlot: getTimeSlot(jsDate.getHours()),
      };
    }
  }

  // Try standard date string
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return {
      date: parsed,
      dayOfWeek: parsed.getDay(),
      dayName: DAY_NAMES[parsed.getDay()],
      hour: parsed.getHours(),
      timeSlot: getTimeSlot(parsed.getHours()),
    };
  }

  return null;
};

// ============ Column Detection ============

const findColumn = (row: CSVRow, patterns: string[]): string | null => {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const found = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
    if (found) return found;
  }
  return null;
};

// ============ Analysis Types ============

export interface DayAnalysis {
  day: string;
  count: number;
  percentage: number;
  avgPerDay: number;
}

export interface TimeAnalysis {
  timeSlot: string;
  count: number;
  percentage: number;
}

export interface NonValidatedReason {
  reason: string;
  count: number;
  percentage: number;
}

export interface AgentNonValidated {
  agentName: string;
  total: number;
  topReasons: NonValidatedReason[];
}

export interface BookingCorrelation {
  factor: string;
  bookedCount: number;
  notBookedCount: number;
  bookingRate: number;
  description: string;
}

export interface InsightsData {
  // Passthrough patterns
  passthroughsByDay: DayAnalysis[];
  passthroughsByTime: TimeAnalysis[];
  bestPassthroughDay: string | null;
  bestPassthroughTime: string | null;

  // Non-validated analysis
  topNonValidatedReasons: NonValidatedReason[];
  agentNonValidated: AgentNonValidated[];

  // Booking correlations
  bookingCorrelations: BookingCorrelation[];

  // Data availability
  hasTimeData: boolean;
  hasNonValidatedReasons: boolean;
  hasBookingData: boolean;

  // Raw stats for AI
  totalPassthroughs: number;
  totalNonValidated: number;
  totalBookings: number;
  totalHotPass: number;
}

// ============ Analysis Functions ============

export const analyzePassthroughsByDay = (passthroughs: CSVRow[]): DayAnalysis[] => {
  if (passthroughs.length === 0) return [];

  const dateCol = findColumn(passthroughs[0], [
    'passthrough to sales date', 'passthrough date', 'created date', 'date'
  ]);

  if (!dateCol) return [];

  const dayCounts: Record<string, number> = {};
  const dayOccurrences: Record<string, Set<string>> = {};

  for (const row of passthroughs) {
    const dt = parseDateTime(row[dateCol]);
    if (dt) {
      dayCounts[dt.dayName] = (dayCounts[dt.dayName] || 0) + 1;
      if (!dayOccurrences[dt.dayName]) dayOccurrences[dt.dayName] = new Set();
      dayOccurrences[dt.dayName].add(dt.date.toDateString());
    }
  }

  const total = Object.values(dayCounts).reduce((a, b) => a + b, 0);

  return DAY_NAMES.map(day => ({
    day,
    count: dayCounts[day] || 0,
    percentage: total > 0 ? ((dayCounts[day] || 0) / total) * 100 : 0,
    avgPerDay: dayOccurrences[day] ? (dayCounts[day] || 0) / dayOccurrences[day].size : 0,
  })).sort((a, b) => b.count - a.count);
};

export const analyzePassthroughsByTime = (passthroughs: CSVRow[]): TimeAnalysis[] => {
  if (passthroughs.length === 0) return [];

  const dateCol = findColumn(passthroughs[0], [
    'passthrough to sales date', 'passthrough date', 'created date', 'date'
  ]);

  if (!dateCol) return [];

  const timeCounts: Record<string, number> = {};
  let hasTimeData = false;

  for (const row of passthroughs) {
    const dt = parseDateTime(row[dateCol]);
    if (dt) {
      // Check if we have actual time data (not just midnight)
      if (dt.hour !== 0 || dt.date.getMinutes() !== 0) {
        hasTimeData = true;
      }
      timeCounts[dt.timeSlot] = (timeCounts[dt.timeSlot] || 0) + 1;
    }
  }

  if (!hasTimeData) return []; // All times are midnight, likely no time data

  const total = Object.values(timeCounts).reduce((a, b) => a + b, 0);

  return TIME_SLOTS.map(slot => ({
    timeSlot: slot.name,
    count: timeCounts[slot.name] || 0,
    percentage: total > 0 ? ((timeCounts[slot.name] || 0) / total) * 100 : 0,
  })).sort((a, b) => b.count - a.count);
};

export const analyzeNonValidatedReasons = (nonConverted: CSVRow[]): NonValidatedReason[] => {
  if (nonConverted.length === 0) return [];

  const reasonCol = findColumn(nonConverted[0], [
    'non validated reason', 'reason', 'non-validated reason', 'status reason'
  ]);

  if (!reasonCol) return [];

  const reasonCounts: Record<string, number> = {};

  for (const row of nonConverted) {
    const reason = (row[reasonCol] || '').trim();
    // Filter out empty, purely numeric, or very short values (likely not real reasons)
    if (reason && !/^\d+$/.test(reason) && reason.length > 1) {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }

  const total = Object.values(reasonCounts).reduce((a, b) => a + b, 0);

  return Object.entries(reasonCounts)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

export const analyzeNonValidatedByAgent = (nonConverted: CSVRow[]): AgentNonValidated[] => {
  if (nonConverted.length === 0) return [];

  const keys = Object.keys(nonConverted[0] || {});
  const agentCol = keys.find(k =>
    k.toLowerCase().includes('lead owner') ||
    k.toLowerCase().includes('agent') ||
    k.includes('_agent')
  );
  const reasonCol = findColumn(nonConverted[0], [
    'non validated reason', 'reason', 'non-validated reason', 'status reason'
  ]);

  if (!agentCol || !reasonCol) return [];

  const agentReasons: Record<string, Record<string, number>> = {};
  let currentAgent = '';

  for (const row of nonConverted) {
    const agent = (row[agentCol] || '').trim();
    if (agent && !/^\d+$/.test(agent)) currentAgent = agent;

    const reason = (row[reasonCol] || '').trim();
    // Filter out empty, purely numeric, or very short values
    if (currentAgent && reason && !/^\d+$/.test(reason) && reason.length > 1) {
      if (!agentReasons[currentAgent]) agentReasons[currentAgent] = {};
      agentReasons[currentAgent][reason] = (agentReasons[currentAgent][reason] || 0) + 1;
    }
  }

  return Object.entries(agentReasons)
    .map(([agentName, reasons]) => {
      const total = Object.values(reasons).reduce((a, b) => a + b, 0);
      const topReasons = Object.entries(reasons)
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return { agentName, total, topReasons };
    })
    .sort((a, b) => b.total - a.total);
};

export const analyzeBookingCorrelations = (
  hotPass: CSVRow[],
  _bookings: CSVRow[],
  passthroughs: CSVRow[]
): BookingCorrelation[] => {
  const correlations: BookingCorrelation[] = [];

  if (hotPass.length === 0 || passthroughs.length === 0) return correlations;

  // Find relevant columns
  const hotPassDateCol = findColumn(hotPass[0], ['created date', 'enquiry date', 'trip created']);
  const passthroughDateCol = findColumn(passthroughs[0], ['passthrough to sales date', 'passthrough date']);

  if (!hotPassDateCol || !passthroughDateCol) return correlations;

  // Analyze day of week correlation
  const dayBookings: Record<string, { total: number; booked: number }> = {};

  for (const hp of hotPass) {
    const dt = parseDateTime(hp[hotPassDateCol]);
    if (dt) {
      if (!dayBookings[dt.dayName]) dayBookings[dt.dayName] = { total: 0, booked: 0 };
      dayBookings[dt.dayName].total++;
    }
  }

  // Note: This is a simplified correlation - in reality you'd need to match
  // individual records to determine if they resulted in bookings

  for (const [day, data] of Object.entries(dayBookings)) {
    if (data.total > 0) {
      // Estimate booking rate (this would need actual matching logic)
      correlations.push({
        factor: `Enquiries on ${day}`,
        bookedCount: Math.round(data.total * 0.15), // Placeholder
        notBookedCount: data.total - Math.round(data.total * 0.15),
        bookingRate: 15, // Placeholder
        description: `Hot passes created on ${day}`,
      });
    }
  }

  return correlations.sort((a, b) => b.bookingRate - a.bookingRate).slice(0, 5);
};

// ============ Main Analysis Function ============

export const generateInsightsData = (rawData: RawParsedData): InsightsData => {
  const passthroughsByDay = analyzePassthroughsByDay(rawData.passthroughs);
  const passthroughsByTime = analyzePassthroughsByTime(rawData.passthroughs);
  const topNonValidatedReasons = analyzeNonValidatedReasons(rawData.nonConverted);
  const agentNonValidated = analyzeNonValidatedByAgent(rawData.nonConverted);
  const bookingCorrelations = analyzeBookingCorrelations(
    rawData.hotPass,
    rawData.bookings,
    rawData.passthroughs
  );

  return {
    passthroughsByDay,
    passthroughsByTime,
    bestPassthroughDay: passthroughsByDay[0]?.day || null,
    bestPassthroughTime: passthroughsByTime[0]?.timeSlot || null,
    topNonValidatedReasons,
    agentNonValidated,
    bookingCorrelations,
    hasTimeData: passthroughsByTime.length > 0,
    hasNonValidatedReasons: topNonValidatedReasons.length > 0,
    hasBookingData: rawData.bookings.length > 0,
    totalPassthroughs: rawData.passthroughs.length,
    totalNonValidated: rawData.nonConverted.length,
    totalBookings: rawData.bookings.length,
    totalHotPass: rawData.hotPass.length,
  };
};

// ============ AI Analysis ============

export const buildInsightsPrompt = (insights: InsightsData): string => {
  const daySection = insights.passthroughsByDay.length > 0
    ? `PASSTHROUGH BY DAY OF WEEK:\n${insights.passthroughsByDay.map(d =>
        `- ${d.day}: ${d.count} (${d.percentage.toFixed(1)}%), avg ${d.avgPerDay.toFixed(1)}/day`
      ).join('\n')}`
    : 'No day-of-week data available';

  const timeSection = insights.hasTimeData
    ? `\nPASSTHROUGH BY TIME OF DAY:\n${insights.passthroughsByTime.map(t =>
        `- ${t.timeSlot}: ${t.count} (${t.percentage.toFixed(1)}%)`
      ).join('\n')}`
    : '\nNo time-of-day data available (timestamps may not include time)';

  const reasonsSection = insights.hasNonValidatedReasons
    ? `\nTOP NON-VALIDATED REASONS (Department):\n${insights.topNonValidatedReasons.map(r =>
        `- "${r.reason}": ${r.count} (${r.percentage.toFixed(1)}%)`
      ).join('\n')}`
    : '\nNo non-validated reason data available';

  const agentSection = insights.agentNonValidated.length > 0
    ? `\nTOP AGENTS BY NON-VALIDATED COUNT:\n${insights.agentNonValidated.slice(0, 5).map(a =>
        `- ${a.agentName}: ${a.total} total, top reason: "${a.topReasons[0]?.reason || 'N/A'}"`
      ).join('\n')}`
    : '';

  return `You are a data analyst examining sales department performance data. Provide actionable insights based on the patterns below.

OVERVIEW:
- Total Passthroughs: ${insights.totalPassthroughs}
- Total Hot Passes: ${insights.totalHotPass}
- Total Bookings: ${insights.totalBookings}
- Total Non-Validated: ${insights.totalNonValidated}

${daySection}
${timeSection}
${reasonsSection}
${agentSection}

Provide analysis in this format (be specific with numbers and percentages):

**Key Findings:**
- [3-4 bullet points with the most important patterns discovered]

**Optimal Timing Recommendations:**
- [2-3 bullet points on best days/times for passthroughs based on the data]

**Non-Validated Lead Insights:**
- [2-3 bullet points analyzing the common reasons and suggesting improvements]

**Actionable Recommendations:**
- [3-4 specific, actionable recommendations for the department]`;
};

export const generateAIInsights = async (
  insights: InsightsData,
  apiKey: string
): Promise<string> => {
  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const prompt = buildInsightsPrompt(insights);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : '';
};

// ============ Column Discovery (for debugging) ============

export const discoverColumns = (rawData: RawParsedData): Record<string, string[]> => {
  return {
    trips: Object.keys(rawData.trips[0] || {}),
    quotes: Object.keys(rawData.quotes[0] || {}),
    passthroughs: Object.keys(rawData.passthroughs[0] || {}),
    hotPass: Object.keys(rawData.hotPass[0] || {}),
    bookings: Object.keys(rawData.bookings[0] || {}),
    nonConverted: Object.keys(rawData.nonConverted[0] || {}),
  };
};
